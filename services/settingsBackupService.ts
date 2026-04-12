import { getTemplates, saveTemplate } from './templateService';
import { Template } from '../types';

// LocalStorage 키
const AUTO_BACKUP_KEY = 'pagegenie_auto_backup_enabled';
const LAST_BACKUP_DATE_KEY = 'pagegenie_last_backup_date';

// Cloud Functions Base URL
const FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || '';

/**
 * 백업할 설정 데이터 인터페이스
 */
export interface BackupSettings {
  templates: Template[];
  backupDate: string;
}

/**
 * 자동 백업 활성화 여부 확인
 */
export const isAutoBackupEnabled = (): boolean => {
  return localStorage.getItem(AUTO_BACKUP_KEY) === 'true';
};

/**
 * 자동 백업 활성화/비활성화 설정
 */
export const setAutoBackupEnabled = (enabled: boolean): void => {
  localStorage.setItem(AUTO_BACKUP_KEY, enabled.toString());
};

/**
 * 마지막 백업 날짜 가져오기
 */
export const getLastBackupDate = (): string | null => {
  return localStorage.getItem(LAST_BACKUP_DATE_KEY);
};

/**
 * 마지막 백업 날짜 저장
 */
const setLastBackupDate = (date: string): void => {
  localStorage.setItem(LAST_BACKUP_DATE_KEY, date);
};

/**
 * 리콜 시 현재 로컬에 템플릿 세팅이 아예 비어있는지 확인
 */
export const isSettingsEmpty = (): boolean => {
  try {
    const templatesStr = localStorage.getItem('gemini_commerce_templates');
    if (!templatesStr) return true;
    const templates = JSON.parse(templatesStr);
    return !templates || templates.length === 0;
  } catch (e) {
    return true;
  }
};

/**
 * 백업된 설정을 로컬에 적용
 */
export const applyRestoredSettings = async (settings: BackupSettings): Promise<void> => {
  try {
    if (settings && settings.templates) {
      localStorage.setItem('gemini_commerce_templates', JSON.stringify(settings.templates));
      // 여기서 추가적인 전역 상태 업데이트가 필요할 수도 있지만,
      // 일반적으로 App에서 강제 리렌더링을 유도합니다.
    }
  } catch(e) {
    console.warn("Error applying restored settings: ", e);
  }
};

/**
 * 설정을 Firebase에 백업
 * @returns 성공 여부
 */
export const backupSettingsToDrive = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (!FUNCTIONS_URL) {
      return { success: false, message: 'Cloud Functions URL이 설정되지 않았습니다. .env 파일의 VITE_CLOUD_FUNCTIONS_URL을 확인하세요.' };
    }
    
    // 백업할 설정 데이터 구성
    const templates = await getTemplates();
    const settings: BackupSettings = {
      templates,
      backupDate: new Date().toISOString()
    };
    
    console.log('[Backup] 설정 백업 시작...', { 
      templatesCount: settings.templates.length 
    });
    
    // Cloud Functions에 백업 요청
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(`${FUNCTIONS_URL}/backupSettings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        const backupDate = new Date().toISOString();
        setLastBackupDate(backupDate);
        console.log('[Backup] 백업 성공');
        return { success: true, message: `설정이 Firebase에 백업되었습니다. (템플릿 ${settings.templates.length}개)` };
      } else {
        throw new Error(result.message || '백업 실패');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('백업 요청이 타임아웃되었습니다 (30초)');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Backup] 백업 실패:', error);
    return { 
      success: false, 
      message: `백업 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
    };
  }
};

/**
 * Firebase에서 설정 복원
 * @returns 성공 여부
 */
export const restoreSettingsFromDrive = async (): Promise<{ success: boolean; message: string; settings?: BackupSettings; status?: string }> => {
  try {
    if (!FUNCTIONS_URL) {
      return { success: false, message: 'Cloud Functions URL이 설정되지 않았습니다.', status: 'error' };
    }
    
    console.log('[Restore] 설정 복원 시작...');
    
    // Cloud Functions에서 설정 가져오기
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(`${FUNCTIONS_URL}/restoreSettings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'not_found') {
        return { success: false, message: '백업된 설정이 없습니다. 먼저 백업을 진행해주세요.', status: 'not_found' };
      }
      
      if (result.status === 'success' && result.settings) {
        const settings = result.settings as BackupSettings;
        
        // 템플릿 복원
        let restoredCount = 0;
        if (settings.templates && Array.isArray(settings.templates)) {
          for (const template of settings.templates) {
            await saveTemplate(template);
            restoredCount++;
          }
        }
        
        console.log('[Restore] 복원 성공:', {
          templates: restoredCount,
          backupDate: settings.backupDate
        });
        
        const backupDateStr = settings.backupDate 
          ? new Date(settings.backupDate).toLocaleString('ko-KR')
          : '알 수 없음';
        
        return { 
          success: true, 
          message: `설정이 복원되었습니다!\n\n` +
                   `📅 백업 시점: ${backupDateStr}\n` +
                   `📋 템플릿: ${restoredCount}개 복원\n\n` +
                   `페이지를 새로고침하면 복원된 설정이 적용됩니다.`,
          settings: settings,
          status: 'success'
        };
      } else {
        throw new Error(result.message || '복원 데이터를 읽을 수 없습니다');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('복원 요청이 타임아웃되었습니다 (30초)');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Restore] 복원 실패:', error);
    return { 
      success: false, 
      message: `복원 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      status: 'error'
    };
  }
};

/**
 * 자동 백업 실행 (앱 시작 시)
 */
export const performAutoBackup = async (): Promise<void> => {
  if (!isAutoBackupEnabled()) return;
  if (!FUNCTIONS_URL) return;
  
  const lastBackup = getLastBackupDate();
  const now = new Date();
  
  // 마지막 백업이 24시간 이상 지났으면 자동 백업
  if (lastBackup) {
    const lastDate = new Date(lastBackup);
    const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      console.log('[Auto Backup] 최근 백업이 24시간 이내입니다. 건너뜁니다.');
      return;
    }
  }
  
  console.log('[Auto Backup] 자동 백업 시작...');
  const result = await backupSettingsToDrive();
  if (result.success) {
    console.log('[Auto Backup] 자동 백업 성공');
  } else {
    console.warn('[Auto Backup] 자동 백업 실패:', result.message);
  }
};
