// src/components/ErrorBoundary.tsx
// Ловит ошибки рендера, чтобы вместо белого экрана показать понятное сообщение.
// Текст ошибки сохраняется в локальный журнал — его видно в «Данных и конфиденциальности».
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { getBuildId } from '../utils/buildInfo';
import { logError } from '../utils/errorLog';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('boundary', new Error(`${error.message}\n${info.componentStack ?? ''}`));
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          padding: 24,
          boxSizing: 'border-box',
          background: '#0a1210',
          color: '#FFFFFF',
          textAlign: 'center',
          fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 22, lineHeight: 1.2, fontStyle: 'italic' }}>
          Что-то пошло не так
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.7)' }}>
          Экран не смог отрисоваться. Перезапустите приложение — данные тренировок и план
          сохранятся.
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: 'rgba(255, 255, 255, 0.55)',
            maxWidth: 320,
            wordBreak: 'break-word',
          }}
        >
          {this.state.error.message}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: '14px 28px',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            background: 'rgba(76, 175, 80, 0.35)',
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Перезагрузить
        </button>
        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>
          сборка {getBuildId() || 'dev'}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
