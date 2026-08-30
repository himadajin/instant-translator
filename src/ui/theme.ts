import { createTheme } from '@mui/material/styles'

/**
 * Application theme: Material UI defaults with light and dark color schemes.
 * The default mode follows the OS; explicit choices made via `useColorScheme`
 * are persisted by MUI.
 */
export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  // The default selector is `media`, which follows the OS only and cannot be
  // overridden by the in-app mode toggle.
  cssVariables: { colorSchemeSelector: 'data' },
  typography: {
    fontFamily: 'Roboto, "Noto Sans JP", sans-serif',
  },
})
