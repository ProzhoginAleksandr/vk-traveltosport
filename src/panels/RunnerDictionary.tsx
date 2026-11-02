// src/panels/RunnerDictionary.tsx
import { useState } from 'react';
import {
  Panel,
  Group,
  Cell,
  Text,
  Div,
  Header,
  Button,
} from '@vkontakte/vkui';
import { DICTIONARY } from '../utils/dictionary';
import headerImage from '../assets/images/RunnerDictionaryHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { PageBackground } from '../components/PageBackground';

interface RunnerDictionaryProps {
  id: string;
}

// Отступ между краем плашки и полем поиска — одинаковый со всех четырёх сторон
const SEARCH_PADDING = 12;

export const RunnerDictionary = ({ id }: RunnerDictionaryProps) => {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Фильтрация по поиску
  const filteredTerms = DICTIONARY.filter((item) =>
    item.term.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDefinition = selectedTerm
    ? DICTIONARY.find((item) => item.term === selectedTerm)
    : null;

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
        .vkuiCell { background: transparent !important; }

        /* Поле поиска: свои стили, чтобы не зависеть от внутренних отступов VKUI Search */
        .dictSearch {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 44px;
          padding: 0 12px;
          box-sizing: border-box;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.12);
        }
        .dictSearch:focus-within { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35); }
        .dictSearchInput {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0;
          margin: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #FFFFFF;
          font: 16px Arial, sans-serif; /* 16px — чтобы iOS не увеличивал страницу при фокусе */
        }
        .dictSearchInput::placeholder { color: rgba(255, 255, 255, 0.5); }
        .dictSearchClear {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
        }
      `}</style>

      <PageBackground variant="violet" pattern="ridge" paddingBottom={24}>
        {/* Header с кнопкой «Назад» */}
        <div
          style={{
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
          }}
        >

          <img
            src={headerImage}
            alt="Словарь бегуна"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Детальный просмотр термина */}
        {selectedDefinition ? (
          <Group
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              marginTop: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              padding: '16px',
            }}
          >
            <Text
              weight="2"
              style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: '20px', marginBottom: '12px' }}
            >
              {selectedDefinition.term}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: '1.6' }}>
              {selectedDefinition.definition}
            </Text>

            <Div style={{ marginTop: '16px', padding: 0 }}>
              <Button
                size="l"
                stretched
                mode="secondary"
                onClick={() => setSelectedTerm(null)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: '16px',
                  height: '56px',
                }}
              >
                ← К списку терминов
              </Button>
            </Div>
          </Group>
        ) : (
          <>
            {/* Поиск: обычный div вместо Group, а само поле — свой input вместо VKUI Search.
                Все четыре отступа задаёт один padding плашки. */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginTop: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: SEARCH_PADDING,
                boxSizing: 'border-box',
              }}
            >
              <label className="dictSearch">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" />
                  <path
                    d="M13 13L17 17"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  className="dictSearchInput"
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск термина..."
                  aria-label="Поиск термина"
                />
                {search && (
                  <button
                    type="button"
                    className="dictSearchClear"
                    aria-label="Очистить поиск"
                    onClick={() => setSearch('')}
                  >
                    ✕
                  </button>
                )}
              </label>
            </div>

            {/* Список терминов */}
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  📖 Термины
                </Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginTop: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '4px 0',
              }}
            >
              {filteredTerms.length === 0 ? (
                <Div>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    Ничего не найдено
                  </Text>
                </Div>
              ) : (
                filteredTerms.map((item) => (
                  <Cell
                    key={item.term}
                    onClick={() => setSelectedTerm(item.term)}
                    style={{ background: 'transparent' }}
                  >
                    <Text weight="2" style={{ color: '#FFFFFF' }}>
                      {item.term}
                    </Text>
                  </Cell>
                ))
              )}
            </Group>
          </>
        )}
      </PageBackground>

      <AppTabbar active="brainbooster" />
    </Panel>
  );
};
export default RunnerDictionary;
