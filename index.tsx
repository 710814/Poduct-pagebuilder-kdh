import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

console.log('index.tsx 로드 시작');
console.log('React:', typeof React);
console.log('ReactDOM:', typeof ReactDOM);

const rootElement = document.getElementById('root');
console.log('Root element 찾기:', rootElement);

if (!rootElement) {
  console.error("Root element를 찾을 수 없습니다!");
  throw new Error("Could not find root element to mount to");
}

try {
  console.log('ReactDOM.createRoot 호출 시작');
  const root = ReactDOM.createRoot(rootElement);
  console.log('Root 생성 완료, 렌더링 시작');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('렌더링 완료');
} catch (error) {
  console.error('React 렌더링 오류:', error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; background: #fee; border: 2px solid #f00; margin: 20px; font-family: sans-serif;">
        <h1 style="color: #c00;">렌더링 오류 발생</h1>
        <p style="color: #333;">${error instanceof Error ? error.message : String(error)}</p>
        <p style="color: #666;">브라우저 콘솔을 확인하세요.</p>
        <pre style="background: #fff; padding: 10px; border: 1px solid #ccc; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `;
  }
}