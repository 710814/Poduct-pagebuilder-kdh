/**
 * PageGenie - Firebase Cloud Functions
 * 
 * 기존 Google Apps Script(GAS) 백엔드를 대체하는 Cloud Functions입니다.
 * - Gemini API 프록시 (API 키를 서버에서만 관리)
 * - Firestore에 상품 데이터 저장
 * - Firebase Storage에 이미지/HTML 파일 업로드
 * - 템플릿 CRUD (Firestore)
 * - 설정 백업/복원 (Firestore)
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cors = require("cors");

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Gemini API 키 (Firebase Secrets에서 자동 주입)
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ============================================================
// 부트스트랩 관리자 — 첫 로그인 시 이 이메일은 자동으로 approved+admin
// (이미 users/{uid} 문서가 존재하면 적용되지 않음 — 기존 사용자는 관리자 패널에서 직접 변경)
// ============================================================
const BOOTSTRAP_ADMIN_EMAILS = [
  "710814@gmail.com",
  "yassada01@gmail.com",
].map(e => e.toLowerCase());

// CORS 미들웨어
const corsMiddleware = cors({ origin: true });

/**
 * CORS를 적용하는 헬퍼 함수
 */
function withCors(handler) {
  return onRequest({ secrets: [geminiApiKey], timeoutSeconds: 540, memory: "1GiB", cors: true, invoker: "public" }, (req, res) => {
    handler(req, res);
  });
}

/**
 * 라이트 핸들러용 (시크릿 불필요)
 */
function withCorsLight(handler) {
  return onRequest({ timeoutSeconds: 60, cors: true, invoker: "public" }, (req, res) => {
    handler(req, res);
  });
}

// ============================================================
// 1. Gemini API 프록시
// ============================================================
exports.geminiProxy = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  if (!(await requireApproved(req, res))) return;

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ status: "error", message: "model과 contents는 필수입니다." });
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      return res.status(500).json({ status: "error", message: "GEMINI_API_KEY가 설정되지 않았습니다." });
    }

    // Gemini API 호출
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiBody = { contents };
    if (config) {
      geminiBody.generationConfig = config;
      // responseMimeType, responseSchema는 generationConfig 안에 포함
      if (config.responseMimeType) {
        geminiBody.generationConfig.responseMimeType = config.responseMimeType;
      }
      if (config.responseSchema) {
        geminiBody.generationConfig.responseSchema = config.responseSchema;
      }
    }

    console.log(`[Gemini Proxy] 모델: ${model}, 호출 시작...`);

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[Gemini Proxy] API 오류: ${geminiResponse.status}`, errorText);
      return res.status(geminiResponse.status).json({
        status: "error",
        message: `Gemini API 오류 (${geminiResponse.status}): ${errorText}`,
      });
    }

    const data = await geminiResponse.json();
    console.log(`[Gemini Proxy] 성공, candidates: ${data.candidates?.length || 0}`);

    // 기존 GAS와 동일한 응답 구조 유지
    return res.json({ status: "success", data });
  } catch (error) {
    console.error("[Gemini Proxy] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 공통: Authorization 헤더에서 uid 추출 (선택적)
// ============================================================
async function extractUid(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

async function extractDecodedToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.split("Bearer ")[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

// ============================================================
// 사용자 가드 — 승인 상태 / 관리자 권한 확인
// 사용 패턴: const ctx = await requireApproved(req, res); if (!ctx) return;
// 실패 시 res에 응답을 직접 쓰고 null 반환.
// ============================================================
async function requireApproved(req, res) {
  const uid = await extractUid(req);
  if (!uid) {
    res.status(401).json({ status: "error", message: "로그인이 필요합니다." });
    return null;
  }
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    res.status(403).json({ status: "error", code: "NOT_REGISTERED", message: "사용자 등록이 필요합니다." });
    return null;
  }
  const data = snap.data();
  if (data.status !== "approved") {
    res.status(403).json({
      status: "error",
      code: data.status === "pending" ? "PENDING_APPROVAL" : "ACCESS_REVOKED",
      message: data.status === "pending" ? "관리자 승인 대기 중입니다." : "접속 권한이 회수되었습니다.",
      userStatus: data.status,
    });
    return null;
  }
  return { uid, ...data };
}

async function requireAdmin(req, res) {
  const ctx = await requireApproved(req, res);
  if (!ctx) return null;
  if (ctx.role !== "admin") {
    res.status(403).json({ status: "error", code: "NOT_ADMIN", message: "관리자 권한이 필요합니다." });
    return null;
  }
  return ctx;
}

// ============================================================
// 1-b. 로그인 기록 — 사용자 doc upsert 후 상태/역할 반환
// 클라이언트가 로그인 직후 호출. 신규 사용자는 status='pending'으로 생성.
// ============================================================
exports.recordLogin = withCorsLight(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const decoded = await extractDecodedToken(req);
  if (!decoded) {
    return res.status(401).json({ status: "error", message: "유효하지 않은 토큰입니다." });
  }

  try {
    const ref = db.collection("users").doc(decoded.uid);
    const snap = await ref.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!snap.exists) {
      const email = (decoded.email || "").toLowerCase();
      const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(email);
      const initStatus = isBootstrapAdmin ? "approved" : "pending";
      const initRole = isBootstrapAdmin ? "admin" : "user";

      await ref.set({
        uid: decoded.uid,
        email: decoded.email || "",
        displayName: decoded.name || "",
        photoURL: decoded.picture || "",
        status: initStatus,
        role: initRole,
        createdAt: now,
        lastLoginAt: now,
      });
      console.log(
        isBootstrapAdmin
          ? `[Record Login] 부트스트랩 관리자 자동 승격: ${email}`
          : `[Record Login] 신규 사용자 등록 (pending): ${email || decoded.uid}`
      );
      return res.json({ status: "success", userStatus: initStatus, role: initRole, isNew: true });
    }

    // 기존 사용자: 메타 + lastLoginAt 갱신
    await ref.update({
      email: decoded.email || snap.data().email || "",
      displayName: decoded.name || snap.data().displayName || "",
      photoURL: decoded.picture || snap.data().photoURL || "",
      lastLoginAt: now,
    });

    const data = snap.data();
    return res.json({
      status: "success",
      userStatus: data.status,
      role: data.role,
      isNew: false,
    });
  } catch (error) {
    console.error("[Record Login] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 2. 상품 데이터 저장 (Firestore + Storage)
// ============================================================
exports.saveProduct = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const ctx = await requireApproved(req, res);
  if (!ctx) return;

  try {
    const uid = ctx.uid;

    const {
      timestamp, mode, productName, category, features,
      marketingCopy, sectionCount, sections_summary, image_prompts,
      folderName, saveImagesToDrive, images,
      htmlContent, htmlFileName,
      fullPageImage
    } = req.body;

    // 1. Firestore에 상품 텍스트 데이터 저장 (uid 스코핑)
    const productDoc = {
      timestamp: timestamp || new Date().toISOString(),
      mode: mode || "",
      productName: productName || "",
      category: category || "",
      features: features || "",
      marketingCopy: marketingCopy || "",
      sectionCount: sectionCount || 0,
      sections_summary: sections_summary || "",
      image_prompts: image_prompts || "",
      folderName: folderName || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(uid ? { uid } : {}),
    };

    // uid 있으면 users/{uid}/products, 없으면 products (하위호환)
    const colRef = uid
      ? db.collection("users").doc(uid).collection("products")
      : db.collection("products");

    const docRef = await colRef.add(productDoc);
    console.log(`[Save Product] Firestore 저장 완료: ${docRef.id} (uid: ${uid || "anonymous"})`);

    // 2. Firebase Storage에 이미지 업로드
    const bucket = storage.bucket();
    const uploadedImages = [];
    const storageBase = uid ? `users/${uid}` : "products";
    let thumbnailUrl = "";

    if (saveImagesToDrive && images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
          const buffer = Buffer.from(img.base64, "base64");
          const filePath = `${storageBase}/${docRef.id}/images/section_${img.id}.png`;
          const file = bucket.file(filePath);

          // 다운로드 토큰 생성 (firebasestorage.googleapis.com URL은 CORS 기본 허용)
          const token = crypto.randomUUID();
          await file.save(buffer, {
            metadata: {
              contentType: "image/png",
              metadata: { firebaseStorageDownloadTokens: token },
            },
          });

          // CORS 지원 Firebase Storage 다운로드 URL 사용
          const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
          uploadedImages.push({ id: img.id, url: downloadUrl });

          // 첫 번째 이미지를 섬네일로 사용
          if (i === 0) thumbnailUrl = downloadUrl;

          console.log(`[Save Product] 이미지 업로드: ${filePath}`);
        } catch (imgError) {
          console.error(`[Save Product] 이미지 업로드 실패 (${img.id}):`, imgError);
        }
      }
    }

    // 2-b. 상세페이지 통이미지 업로드 (썸네일/미리보기 우선 소스)
    if (fullPageImage) {
      try {
        const fpBuffer = Buffer.from(fullPageImage, "base64");
        const fpPath = `${storageBase}/${docRef.id}/fullpage.jpg`;
        const fpFile = bucket.file(fpPath);
        const fpToken = crypto.randomUUID();
        await fpFile.save(fpBuffer, {
          metadata: {
            contentType: "image/jpeg",
            metadata: { firebaseStorageDownloadTokens: fpToken },
          },
        });
        const fpUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fpPath)}?alt=media&token=${fpToken}`;
        thumbnailUrl = fpUrl;
        console.log(`[Save Product] 통이미지 업로드 완료: ${fpPath} (${(fpBuffer.length / 1024).toFixed(0)}KB)`);
      } catch (fpErr) {
        console.error("[Save Product] 통이미지 업로드 실패:", fpErr);
      }
    }

    // 3. HTML 파일 업로드 (Storage에 저장 + Firestore에 텍스트 저장)
    let htmlStoredContent = "";
    if (htmlContent) {
      try {
        const htmlBuffer = Buffer.from(htmlContent, "base64");
        htmlStoredContent = htmlBuffer.toString("utf-8");

        // 상대경로 이미지를 Firebase Storage 절대 URL로 교체
        // 예: src="images/section_sectionId.png" → src="https://storage.googleapis.com/..."
        for (const img of uploadedImages) {
          htmlStoredContent = htmlStoredContent.replace(
            `src="images/section_${img.id}.png"`,
            `src="${img.url}"`
          );
        }

        const htmlPath = `${storageBase}/${docRef.id}/${htmlFileName || "index.html"}`;
        const htmlFile = bucket.file(htmlPath);
        const htmlFinal = Buffer.from(htmlStoredContent, "utf-8");

        await htmlFile.save(htmlFinal, {
          metadata: { contentType: "text/html; charset=utf-8" },
        });

        await htmlFile.makePublic();
        console.log(`[Save Product] HTML 업로드 (이미지 URL 교체 완료): ${htmlPath}`);
      } catch (htmlError) {
        console.error("[Save Product] HTML 업로드 실패:", htmlError);
      }
    }

    // 4. 섬네일 URL + HTML을 Firestore 문서에 업데이트
    const updateData = {};
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    if (htmlStoredContent) updateData.htmlContent = htmlStoredContent;
    if (Object.keys(updateData).length > 0) {
      await docRef.update(updateData);
    }

    return res.json({
      status: "success",
      message: "상품 데이터가 저장되었습니다.",
      productId: docRef.id,
      uploadedImages,
    });
  } catch (error) {
    console.error("[Save Product] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 2-b. 내 작업물 목록 조회
// ============================================================
exports.getProducts = withCorsLight(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const ctx = await requireApproved(req, res);
  if (!ctx) return;
  const uid = ctx.uid;

  try {
    const snapshot = await db
      .collection("users").doc(uid).collection("products")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const products = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      products.push({
        productId: doc.id,
        productName: d.productName || "",
        createdAt: d.timestamp || new Date().toISOString(),
        mode: d.mode || "",
        thumbnailUrl: d.thumbnailUrl || "",
        sectionCount: d.sectionCount || 0,
        htmlContent: d.htmlContent || "",
      });
    });

    return res.json({ status: "success", products });
  } catch (error) {
    console.error("[Get Products] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 2-c. 작업물 삭제
// ============================================================
exports.deleteProduct = withCorsLight(async (req, res) => {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const ctx = await requireApproved(req, res);
  if (!ctx) return;
  const uid = ctx.uid;

  try {
    const productId = req.body.productId;
    if (!productId) {
      return res.status(400).json({ status: "error", message: "productId가 필요합니다." });
    }

    // 본인 데이터인지 확인 후 삭제
    const docRef = db.collection("users").doc(uid).collection("products").doc(productId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ status: "error", message: "작업물을 찾을 수 없습니다." });
    }

    // 1. Storage 파일 삭제 (productId 하위의 모든 파일)
    try {
      const storageBase = uid ? `users/${uid}` : "products";
      const folderPath = `${storageBase}/${productId}/`;
      const bucket = storage.bucket();
      
      // 해당 경로로 시작하는 모든 파일 삭제
      await bucket.deleteFiles({ prefix: folderPath });
      console.log(`[Delete Product] Storage 폴더 삭제 완료: ${folderPath}`);
    } catch (storageErr) {
      console.error("[Delete Product] Storage 삭제 중 오류 (계속 진행):", storageErr);
      // 스토리지 삭제 실패가 DB 삭제 차단하지 않도록 catch만 함
    }

    // 2. Firestore 문서 삭제
    await docRef.delete();
    console.log(`[Delete Product] Firestore 삭제 완료: ${productId} (uid: ${uid})`);
    return res.json({ status: "success", message: "삭제되었습니다." });
  } catch (error) {
    console.error("[Delete Product] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

/**
 * 2-d. 다운로드용 서명된 URL 생성 (CORS 우회용)
 */
exports.getDownloadUrl = withCorsLight(async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const ctx = await requireApproved(req, res);
  if (!ctx) return;
  const uid = ctx.uid;

  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ status: "error", message: "productId가 필요합니다." });
    }

    // 1. 해당 상품 정보 가져오기
    const doc = await db.collection("users").doc(uid).collection("products").doc(productId).get();
    if (!doc.exists) {
      return res.status(404).json({ status: "error", message: "작업물을 찾을 수 없습니다." });
    }

    const data = doc.data();
    if (!data.thumbnailUrl) {
      return res.status(404).json({ status: "error", message: "이미지 URL이 없습니다." });
    }

    // 2. 다운로드 대상 파일 결정
    // 우선순위: 통이미지(fullpage.jpg) → images/ 하위 첫 번째 파일
    const storageBase = uid ? `users/${uid}` : "products";
    const bucket = storage.bucket();

    let file = null;
    const fullpagePath = `${storageBase}/${productId}/fullpage.jpg`;
    const fullpageFile = bucket.file(fullpagePath);
    const [fullpageExists] = await fullpageFile.exists();
    if (fullpageExists) {
      file = fullpageFile;
    } else {
      const folderPath = `${storageBase}/${productId}/images/`;
      const [files] = await bucket.getFiles({ prefix: folderPath });
      if (files.length === 0) {
        return res.status(404).json({ status: "error", message: "스토리지에서 이미지를 찾을 수 없습니다." });
      }
      file = files[0];
    }

    // 3. 실제 파일 확장자 기준으로 Content-Type/파일명 결정
    const fileName = file.name; // 예: users/uid/pid/fullpage.jpg
    const ext = fileName.split('.').pop().toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const downloadName = `${(data.productName || 'image').replace(/[\/\\?%*:|"<>]/g, '_')}.${ext}`;

    // 4. 서명된 URL 생성 (5분 유효, 강제 다운로드 설정)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000, // 5분
      prompt: false, // 브라우저 팝업 방지
      responseType: contentType,
      responseContentDisposition: `attachment; filename="${encodeURIComponent(downloadName)}"`,
    });

    console.log(`[Get Download URL] 서명된 URL 생성 완료: ${productId}`);
    return res.json({ status: "success", downloadUrl: signedUrl });
  } catch (error) {
    console.error("[Get Download URL] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 3. 템플릿 CRUD
// ============================================================

// GET /templates - 모든 템플릿 조회
exports.getTemplates = withCorsLight(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  if (!(await requireApproved(req, res))) return;

  try {
    const snapshot = await db.collection("templates").orderBy("createdAt", "desc").get();
    const templates = [];
    snapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ status: "success", templates });
  } catch (error) {
    console.error("[Get Templates] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /templates - 템플릿 저장/수정
exports.saveTemplate = withCorsLight(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  if (!(await requireApproved(req, res))) return;

  try {
    const template = req.body;

    if (!template || !template.id) {
      return res.status(400).json({ status: "error", message: "템플릿 데이터가 필요합니다." });
    }

    // ID를 문서 ID로 사용 (upsert)
    await db.collection("templates").doc(template.id).set({
      ...template,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[Save Template] 저장 완료: ${template.id}`);
    return res.json({ status: "success", message: "템플릿이 저장되었습니다." });
  } catch (error) {
    console.error("[Save Template] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// DELETE /templates?id=xxx - 템플릿 삭제
exports.deleteTemplate = withCorsLight(async (req, res) => {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  if (!(await requireApproved(req, res))) return;

  try {
    const templateId = req.query.id || req.body.id;

    if (!templateId) {
      return res.status(400).json({ status: "error", message: "템플릿 ID가 필요합니다." });
    }

    await db.collection("templates").doc(templateId).delete();
    console.log(`[Delete Template] 삭제 완료: ${templateId}`);
    return res.json({ status: "success", message: "템플릿이 삭제되었습니다." });
  } catch (error) {
    console.error("[Delete Template] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 4. 설정 백업/복원
// ============================================================

// POST /backupSettings - 설정 백업
exports.backupSettings = withCorsLight(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ status: "error", message: "설정 데이터가 필요합니다." });
    }

    await db.collection("settings").doc("backup").set({
      ...settings,
      backupDate: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("[Backup Settings] 백업 완료");
    return res.json({ status: "success", message: "설정이 백업되었습니다." });
  } catch (error) {
    console.error("[Backup Settings] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /restoreSettings - 설정 복원
exports.restoreSettings = withCorsLight(async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const doc = await db.collection("settings").doc("backup").get();

    if (!doc.exists) {
      return res.json({ status: "not_found", message: "백업 파일이 없습니다." });
    }

    const settings = doc.data();
    console.log("[Restore Settings] 복원 완료");
    return res.json({ status: "success", settings });
  } catch (error) {
    console.error("[Restore Settings] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// 5. 관리자 API
// ============================================================

const VALID_STATUSES = ["pending", "approved", "revoked"];
const VALID_ROLES = ["user", "admin"];

function tsToIso(ts) {
  if (!ts) return "";
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return "";
}

// GET /adminListUsers - 전체 사용자 목록
exports.adminListUsers = withCorsLight(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  try {
    const snapshot = await db.collection("users").orderBy("createdAt", "desc").get();
    const users = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      users.push({
        uid: doc.id,
        email: d.email || "",
        displayName: d.displayName || "",
        photoURL: d.photoURL || "",
        status: d.status || "pending",
        role: d.role || "user",
        createdAt: tsToIso(d.createdAt),
        lastLoginAt: tsToIso(d.lastLoginAt),
      });
    });

    return res.json({ status: "success", users });
  } catch (error) {
    console.error("[Admin List Users] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /adminUpdateUserStatus - 사용자 상태 변경 (승인/회수)
exports.adminUpdateUserStatus = withCorsLight(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  try {
    const { targetUid, status: newStatus } = req.body;

    if (!targetUid || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({ status: "error", message: "targetUid와 유효한 status가 필요합니다." });
    }

    if (targetUid === adminCtx.uid) {
      return res.status(400).json({ status: "error", message: "본인의 상태는 변경할 수 없습니다." });
    }

    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ status: "error", message: "대상 사용자를 찾을 수 없습니다." });
    }

    await targetRef.update({
      status: newStatus,
      approvedBy: adminCtx.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Admin Update Status] ${targetUid}: ${newStatus} (by ${adminCtx.uid})`);
    return res.json({ status: "success", message: "상태가 변경되었습니다." });
  } catch (error) {
    console.error("[Admin Update Status] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /adminUpdateUserRole - 사용자 역할 변경 (admin/user)
exports.adminUpdateUserRole = withCorsLight(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  try {
    const { targetUid, role: newRole } = req.body;

    if (!targetUid || !VALID_ROLES.includes(newRole)) {
      return res.status(400).json({ status: "error", message: "targetUid와 유효한 role이 필요합니다." });
    }

    if (targetUid === adminCtx.uid) {
      return res.status(400).json({ status: "error", message: "본인의 역할은 변경할 수 없습니다." });
    }

    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ status: "error", message: "대상 사용자를 찾을 수 없습니다." });
    }

    await targetRef.update({ role: newRole });

    console.log(`[Admin Update Role] ${targetUid}: ${newRole} (by ${adminCtx.uid})`);
    return res.json({ status: "success", message: "역할이 변경되었습니다." });
  } catch (error) {
    console.error("[Admin Update Role] 오류:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});
