import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  mergeParameters,
  parseParametersJson,
  parseSamplingFieldText,
  SAMPLING_FIELD_KEYS,
  splitParameters,
  validateProfileDraft,
} from '../translation'
import type { SamplingFieldKey, SamplingFields } from '../translation'
import type { Profile, ProfileDraft } from './types'

type SamplingTexts = Record<SamplingFieldKey, string>

type FormState = {
  /** null while adding a new profile (including a duplicate). */
  id: string | null
  name: string
  baseUrl: string
  apiKey: string
  model: string
  sampling: SamplingTexts
  extraText: string
}

type FormErrors = {
  name?: string
  baseUrl?: string
  sampling?: Partial<Record<SamplingFieldKey, string>>
  extra?: string
}

const EMPTY_SAMPLING: SamplingTexts = {
  temperature: '',
  top_p: '',
  top_k: '',
  repeat_penalty: '',
}

function emptyFormState(): FormState {
  return {
    id: null,
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    sampling: EMPTY_SAMPLING,
    extraText: '',
  }
}

function formStateFor(profile: Profile): FormState {
  const { fields, extra } = splitParameters(profile.parameters)
  const sampling = { ...EMPTY_SAMPLING }
  for (const key of SAMPLING_FIELD_KEYS) {
    const value = fields[key]
    if (value !== undefined) {
      sampling[key] = String(value)
    }
  }
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    sampling,
    extraText:
      Object.keys(extra).length === 0 ? '' : JSON.stringify(extra, null, 2),
  }
}

function duplicateFormStateFor(profile: Profile): FormState {
  return {
    ...formStateFor(profile),
    id: null,
    name: `${profile.name} のコピー`,
  }
}

function validate(form: FormState): {
  errors: FormErrors
  draft: ProfileDraft | null
} {
  const errors: FormErrors = {}
  const draftErrors = validateProfileDraft(form)
  if (draftErrors.name === 'required') {
    errors.name = '表示名を入力してください'
  }
  if (draftErrors.baseUrl === 'required') {
    errors.baseUrl = 'ベース URL を入力してください'
  } else if (draftErrors.baseUrl === 'invalid') {
    errors.baseUrl = 'http または https の URL を入力してください'
  }

  const fields: SamplingFields = {}
  for (const key of SAMPLING_FIELD_KEYS) {
    const result = parseSamplingFieldText(key, form.sampling[key])
    if (!result.ok) {
      errors.sampling = {
        ...errors.sampling,
        [key]:
          result.reason === 'not-integer'
            ? '整数を入力してください'
            : '数値を入力してください',
      }
    } else if (result.value !== undefined) {
      fields[key] = result.value
    }
  }

  const extra = parseParametersJson(form.extraText)
  if (!extra.ok) {
    errors.extra =
      extra.reason === 'reserved-key'
        ? `パラメータに ${extra.key} は指定できません`
        : extra.reason === 'field-key'
          ? `${extra.key} は上のフィールドで指定してください`
          : 'JSON オブジェクトとして解釈できません'
  }

  if (errors.name || errors.baseUrl || errors.sampling || !extra.ok) {
    return { errors, draft: null }
  }
  return {
    errors,
    draft: {
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      model: form.model,
      parameters: mergeParameters(fields, extra.value),
    },
  }
}

export function ProfileSettingsDialog({
  open,
  onClose,
  profiles,
  onProfileAdd,
  onProfileUpdate,
  onProfileDelete,
}: {
  open: boolean
  onClose: () => void
  profiles: readonly Profile[]
  onProfileAdd: (draft: ProfileDraft) => void
  onProfileUpdate: (id: string, draft: ProfileDraft) => void
  onProfileDelete: (id: string) => void
}) {
  const [form, setForm] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  const closeForm = () => {
    setForm(null)
    setErrors({})
  }

  const handleClose = () => {
    closeForm()
    onClose()
  }

  const handleSave = () => {
    if (form === null) {
      return
    }
    const result = validate(form)
    if (result.draft === null) {
      setErrors(result.errors)
      return
    }
    if (form.id === null) {
      onProfileAdd(result.draft)
    } else {
      onProfileUpdate(form.id, result.draft)
    }
    closeForm()
  }

  const setField =
    (field: 'name' | 'baseUrl' | 'apiKey' | 'model' | 'extraText') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) =>
        current === null ? null : { ...current, [field]: event.target.value },
      )
    }

  const setSamplingField =
    (key: SamplingFieldKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) =>
        current === null
          ? null
          : {
              ...current,
              sampling: { ...current.sampling, [key]: event.target.value },
            },
      )
    }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>プロファイル設定</DialogTitle>
      {form === null ? (
        <>
          <DialogContent>
            <List disablePadding>
              {profiles.map((profile) => (
                <ListItem
                  key={profile.id}
                  divider
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        aria-label={`${profile.name} を編集`}
                        onClick={() => setForm(formStateFor(profile))}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={`${profile.name} を複製`}
                        onClick={() => setForm(duplicateFormStateFor(profile))}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={`${profile.name} を削除`}
                        disabled={profiles.length === 1}
                        onClick={() => onProfileDelete(profile.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={profile.name}
                    secondary={
                      profile.model === ''
                        ? profile.baseUrl
                        : `${profile.model} — ${profile.baseUrl}`
                    }
                  />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setForm(emptyFormState())}
              sx={{ mr: 'auto' }}
            >
              プロファイルを追加
            </Button>
            <Button onClick={handleClose}>閉じる</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="表示名"
                required
                value={form.name}
                onChange={setField('name')}
                error={errors.name !== undefined}
                helperText={errors.name}
              />
              <TextField
                label="ベース URL"
                required
                value={form.baseUrl}
                onChange={setField('baseUrl')}
                error={errors.baseUrl !== undefined}
                helperText={
                  errors.baseUrl ?? '例: https://openrouter.ai/api/v1'
                }
              />
              <TextField
                label="API キー"
                type="password"
                value={form.apiKey}
                onChange={setField('apiKey')}
                helperText="不要な推論先では空のままにする"
              />
              <TextField
                label="モデル名"
                value={form.model}
                onChange={setField('model')}
                helperText="空にすると model を送らない"
              />
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  サンプリングパラメータ。空欄は送信せず、推論先の既定に従う。
                </Typography>
                <Stack
                  direction="row"
                  spacing={2}
                  useFlexGap
                  sx={{ flexWrap: 'wrap' }}
                >
                  {SAMPLING_FIELD_KEYS.map((key) => (
                    <TextField
                      key={key}
                      label={key}
                      size="small"
                      value={form.sampling[key]}
                      onChange={setSamplingField(key)}
                      error={errors.sampling?.[key] !== undefined}
                      helperText={errors.sampling?.[key]}
                      sx={{ width: 'calc(50% - 8px)' }}
                      slotProps={{
                        htmlInput: { inputMode: 'decimal' },
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
              <TextField
                label="追加パラメータ (JSON)"
                multiline
                minRows={3}
                value={form.extraText}
                onChange={setField('extraText')}
                error={errors.extra !== undefined}
                helperText={
                  errors.extra ??
                  'プロバイダ固有のパラメータをそのままリクエストへ含める'
                }
                slotProps={{
                  input: { sx: { fontFamily: 'monospace' } },
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm}>キャンセル</Button>
            <Button variant="contained" onClick={handleSave}>
              保存
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
