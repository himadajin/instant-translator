import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import {
  TONE_OPTIONS,
  type Tone,
  type TranslationDirection,
  type TranslationMethod,
} from './types'
import styles from '../styles/Toolbar.module.css'

const LANGUAGE_NAMES: Record<
  TranslationDirection,
  { source: string; target: string }
> = {
  jaToEn: { source: '日本語', target: 'ENGLISH' },
  enToJa: { source: 'ENGLISH', target: '日本語' },
}

export function Toolbar({
  direction,
  isDirectionFixed,
  onSwapDirection,
  onReleaseFixedDirection,
  translationMethod,
  onTranslationMethodChange,
  tone,
  onToneChange,
}: {
  direction: TranslationDirection
  isDirectionFixed: boolean
  onSwapDirection: () => void
  onReleaseFixedDirection: () => void
  translationMethod: TranslationMethod
  onTranslationMethodChange: (method: TranslationMethod) => void
  tone: Tone
  onToneChange: (tone: Tone) => void
}) {
  const { source, target } = LANGUAGE_NAMES[direction]
  const toneLabel =
    TONE_OPTIONS.find((option) => option.value === tone)?.label ?? tone

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        {isDirectionFixed ? (
          <button
            type="button"
            className={styles.modeLabel}
            onClick={onReleaseFixedDirection}
            aria-label="FIXED: 押すと自動検出へ戻る"
          >
            FIXED
          </button>
        ) : (
          <span className={styles.modeLabel}>AUTO</span>
        )}
        <span className={styles.language}>{source}</span>
        <button
          type="button"
          className={styles.swap}
          onClick={onSwapDirection}
          aria-label="翻訳方向を入れ替えて固定する"
        >
          ⇄
        </button>
        <span className={styles.language}>{target}</span>
      </div>

      <div className={styles.group}>
        <span className={styles.metaLabel} id="settings-standard-label">
          STANDARD
        </span>
        <ToggleGroup.Root
          type="single"
          className={styles.methodGroup}
          value={translationMethod}
          onValueChange={(value) => {
            if (value) onTranslationMethodChange(value as TranslationMethod)
          }}
          aria-labelledby="settings-standard-label"
        >
          <ToggleGroup.Item className={styles.chip} value="standard">
            標準翻訳
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.chip} value="idiomatic">
            意訳
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        <span className={styles.metaLabel} id="settings-tone-label">
          TONE
        </span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={styles.toneTrigger}
            aria-labelledby="settings-tone-label settings-tone-value"
          >
            <span id="settings-tone-value">{toneLabel}</span>
            <span aria-hidden="true">▾</span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.toneMenu}
              aria-labelledby="settings-tone-label"
              sideOffset={8}
              align="start"
            >
              <DropdownMenu.RadioGroup
                value={tone}
                onValueChange={(value) => onToneChange(value as Tone)}
              >
                {TONE_OPTIONS.map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    className={styles.toneOption}
                  >
                    {option.label}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}
