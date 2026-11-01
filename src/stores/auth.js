import { computed, reactive } from 'vue'
import { api, APP_MODE, IS_DEMO, supabase } from '../services/api.js'
import { permisosDe } from '../data/constants.js'
import { wait } from '../data/utils.js'

const DEMO_LOCAL_KEY = 'cooperativa-utiles:sesion'
const DEMO_TEMP_KEY = 'cooperativa-utiles:sesion-temporal'

const state = reactive({
  user: null,
  ready: false,
  loading: false,
  error: '',
  mode: APP_MODE,
})

let initPromise = null
let supabaseListener = false

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    curso: row.curso,
    rol: row.rol,
    email: row.email,
    activo: row.activo,
    createdAt: row.created_at,
  }
}

function clearDemoSession() {
  localStorage.removeItem(DEMO_LOCAL_KEY)
  sessionStorage.removeItem(DEMO_TEMP_KEY)
}

function saveDemoSession(userId, remember) {
  clearDemoSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(remember ? DEMO_LOCAL_KEY : DEMO_TEMP_KEY, userId)
}

async function loadSupabaseProfile(uid, { retries = 3 } = {}) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      throw new Error(error.message)
    }
    if (data) {
      state.user = mapProfile(data)
      return state.user
    }
    if (attempt < retries) await wait(400)
  }
  throw new Error(
    'La sesión existe pero no se encontró el perfil. Verificá que el script SQL y su trigger de registro estén ejecutados.',
  )
}

async function initDemo() {
  const id = localStorage.getItem(DEMO_LOCAL_KEY) || sessionStorage.getItem(DEMO_TEMP_KEY)
  if (!id) return
  try {
    const users = await api.listUsuarios()
    const found = users.find((u) => u.id === id)
    if (found) state.user = found
    else clearDemoSession()
  } catch (error) {
    state.error = error.message
    clearDemoSession()
  }
}

async function initSupabase() {
  if (!supabase) return
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    state.error = error.message
    return
  }
  if (data.session?.user) {
    try {
      await loadSupabaseProfile(data.session.user.id)
    } catch (profileError) {
      state.error = profileError.message
      state.user = null
    }
  }
  if (!supabaseListener) {
    supabaseListener = true
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') state.user = null
    })
  }
}

async function init() {
  if (state.ready) return
  if (!initPromise) {
    initPromise = (async () => {
      try {
        if (IS_DEMO) await initDemo()
        else await initSupabase()
      } finally {
        state.ready = true
      }
    })()
  }
  return initPromise
}

async function login({ email, password, remember = true }) {
  state.loading = true
  state.error = ''
  try {
    if (IS_DEMO) {
      const user = await api.login(email, password)
      saveDemoSession(user.id, remember)
      state.user = user
      return user
    }
    const authUser = await api.login(email, password)
    await loadSupabaseProfile(authUser.id)
    return state.user
  } catch (error) {
    state.error = error.message
    throw error
  } finally {
    state.loading = false
  }
}

async function register(payload) {
  state.loading = true
  state.error = ''
  try {
    if (IS_DEMO) {
      const user = await api.register(payload)
      saveDemoSession(user.id, true)
      state.user = user
      return { user, needsConfirmation: false }
    }
    const result = await api.register(payload)
    if (!result.session) {
      return {
        user: null,
        needsConfirmation: true,
        message: 'Te enviamos un correo para confirmar la cuenta. Después podés ingresar.',
      }
    }
    await loadSupabaseProfile(result.user.id, { retries: 5 })
    return { user: state.user, needsConfirmation: false }
  } catch (error) {
    state.error = error.message
    throw error
  } finally {
    state.loading = false
  }
}

async function logout() {
  state.loading = true
  try {
    if (IS_DEMO) {
      clearDemoSession()
      state.user = null
    } else {
      await supabase.auth.signOut()
      state.user = null
    }
  } finally {
    state.loading = false
  }
}

async function cambiarRolDemo(rol) {
  if (!IS_DEMO) throw new Error('El cambio libre de rol solo existe en la demostración.')
  if (!state.user) throw new Error('No hay una sesión activa.')
  const updated = await api.simularRol(state.user.id, rol)
  state.user = updated
  return updated
}

async function asignarRol(usuarioId, rol) {
  const updated = await api.actualizarRol(usuarioId, rol, state.user?.id)
  if (state.user?.id === usuarioId) state.user = updated
  return updated
}

async function refreshUser() {
  if (!state.user) return
  if (IS_DEMO) {
    const users = await api.listUsuarios()
    state.user = users.find((u) => u.id === state.user.id) ?? null
  } else if (supabase) {
    await loadSupabaseProfile(state.user.id)
  }
}

async function resetDemoData() {
  if (!IS_DEMO) throw new Error('El reinicio solo está disponible en la demo.')
  await api.resetDemo()
  const users = await api.listUsuarios()
  const stillExists = state.user && users.find((u) => u.id === state.user.id)
  if (stillExists) state.user = stillExists
  else {
    clearDemoSession()
    state.user = null
  }
}

const isAuthenticated = computed(() => Boolean(state.user))
const permisos = computed(() => permisosDe(state.user?.rol))
const isPresidente = computed(() => state.user?.rol === 'presidente')

export function useAuth() {
  return {
    state,
    isAuthenticated,
    isPresidente,
    permisos,
    init,
    login,
    register,
    logout,
    cambiarRolDemo,
    asignarRol,
    refreshUser,
    resetDemoData,
    demoAccounts: () => api.listDemoAccounts(),
  }
}
