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
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { parseParametersJson, validateProfileDraft } from '../translation'
import type { Profile, ProfileDraft } from './types'

type FormState = {
  /** null while adding a new profile. */
  id: string | null
  name: string
  baseUrl: string
  apiKey: string
  model: string
  parametersText: string
}

type FormErrors = {
  name?: string
  baseUrl?: string
  parameters?: string
}

function formStateFor(profile: Profile | null): FormState {
  if (profile === null) {
    return {
      id: null,
      name: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      parametersText: '',
    }
  }
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    parametersText:
      Object.keys(profile.parameters).length === 0
        ? ''
        : JSON.stringify(profile.parameters, null, 2),
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

  const parameters = parseParametersJson(form.parametersText)
  if (!parameters.ok) {
    errors.parameters =
      parameters.reason === 'reserved-key'
        ? `パラメータに ${parameters.key} は指定できません`
        : 'JSON オブジェクトとして解釈できません'
  }

  if (errors.name || errors.baseUrl || !parameters.ok) {
    return { errors, draft: null }
  }
  return {
    errors,
    draft: {
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      model: form.model,
      parameters: parameters.value,
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
    (field: keyof Omit<FormState, 'id'>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) =>
        current === null ? null : { ...current, [field]: event.target.value },
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
              onClick={() => setForm(formStateFor(null))}
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
              <TextField
                label="パラメータ (JSON)"
                multiline
                minRows={4}
                value={form.parametersText}
                onChange={setField('parametersText')}
                error={errors.parameters !== undefined}
                helperText={
                  errors.parameters ??
                  'リクエストボディへそのまま含める。例: {"temperature": 0.7}'
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
