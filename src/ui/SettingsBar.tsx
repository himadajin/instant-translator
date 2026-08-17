import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { TONE_OPTIONS, type Tone, type TranslationMode } from './types'
import styles from '../styles/SettingsBar.module.css'

export function SettingsBar({
  translationMode,
  onTranslationModeChange,
  tone,
  onToneChange,
}: {
  translationMode: TranslationMode
  onTranslationModeChange: (mode: TranslationMode) => void
  tone: Tone
  onToneChange: (tone: Tone) => void
}) {
  const [isToneOpen, setIsToneOpen] = useState(false)
  const toneLabel =
    TONE_OPTIONS.find((option) => option.value === tone)?.label ?? tone

  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <span className={styles.metaLabel} id="settings-standard-label">
          STANDARD
        </span>
        <ToggleGroup.Root
          type="single"
          className={styles.toggleGroup}
          value={translationMode}
          onValueChange={(value) => {
            if (value) onTranslationModeChange(value as TranslationMode)
          }}
          aria-labelledby="settings-standard-label"
        >
          <ToggleGroup.Item className={styles.toggleItem} value="standard">
            標準翻訳
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.toggleItem} value="paraphrase">
            意訳
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      <div className={styles.group}>
        <span className={styles.metaLabel} id="settings-tone-label">
          TONE
        </span>
        <Popover.Root open={isToneOpen} onOpenChange={setIsToneOpen}>
          <Popover.Trigger
            className={styles.toneTrigger}
            aria-labelledby="settings-tone-label settings-tone-value"
          >
            <span id="settings-tone-value">{toneLabel}</span>
            <span aria-hidden="true">▾</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className={styles.tonePopover}
              sideOffset={8}
              align="start"
            >
              <div
                role="radiogroup"
                aria-label="口調"
                className={styles.toneList}
              >
                {TONE_OPTIONS.map((option) => {
                  const isSelected = option.value === tone
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={styles.toneOption}
                      data-selected={isSelected || undefined}
                      onClick={() => {
                        onToneChange(option.value)
                        setIsToneOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  )
}
