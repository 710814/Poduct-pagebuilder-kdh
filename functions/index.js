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

// CORS 미들웨어
const corsMiddleware = cors({ origin: true });

/**
 * CORS를 적용하는 헬퍼 함수
 */
function withCors(handler) {
  return onRequest({ secrets: [geminiApiKey], timeoutSeconds: 540, memory: "1GiB" }, (req, res) => {
    corsMiddleware(req, res, () => handler(req, res));
  });
}

/**
 * 라이트 핸들러용 (시크릿 불필요)
 */
function withCorsLight(handler) {
  return onRequest({ timeoutSeconds: 60 }, (req, res) => {
    corsMiddleware(req, res, () => handler(req, res));
  });
}

// ============================================================
// 1. Gemini API 프록시
// ============================================================
exports.geminiProxy = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

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
// 2. 상품 데이터 저장 (Firestore + Storage)
// ============================================================
exports.saveProduct = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const {
      timestamp, mode, productName, category, features,
      marketingCopy, sectionCount, sections_summary, image_prompts,
      folderName, saveImagesToDrive, images, sections,
      htmlContent, htmlFileName
    } = req.body;

    // 1. Firestore에 상품 텍스트 데이터 저장
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
    };

    const docRef = await db.collection("products").add(productDoc);
    console.log(`[Save Product] Firestore 저장 완료: ${docRef.id}`);

    // 2. Firebase Storage에 이미지 업로드
    const bucket = storage.bucket();
    const uploadedImages = [];

    if (saveImagesToDrive && images && images.length > 0) {
      for (const img of images) {
        try {
          const buffer = Buffer.from(img.base64, "base64");
          const filePath = `products/${docRef.id}/images/section_${img.id}.png`;
          const file = bucket.file(filePath);

          await file.save(buffer, {
            metadata: { contentType: "image/png" },
          });

          // 공개 URL 생성
          await file.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
          uploadedImages.push({ id: img.id, url: publicUrl });

          console.log(`[Save Product] 이미지 업로드: ${filePath}`);
        } catch (imgError) {
          console.error(`[Save Product] 이미지 업로드 실패 (${img.id}):`, imgError);
        }
      }
    }

    // 3. HTML 파일 업로드
    if (htmlContent) {
      try {
        const htmlBuffer = Buffer.from(htmlContent, "base64");
        const htmlPath = `products/${docRef.id}/${htmlFileName || "index.html"}`;
        const htmlFile = bucket.file(htmlPath);

        await htmlFile.save(htmlBuffer, {
          metadata: { contentType: "text/html; charset=utf-8" },
        });

        await htmlFile.makePublic();
        console.log(`[Save Product] HTML 업로드: ${htmlPath}`);
      } catch (htmlError) {
        console.error("[Save Product] HTML 업로드 실패:", htmlError);
      }
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
// 3. 템플릿 CRUD
// ============================================================

// GET /templates - 모든 템플릿 조회
exports.getTemplates = withCorsLight(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

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
