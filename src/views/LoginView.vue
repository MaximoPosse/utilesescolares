<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { CURSOS, ROLES } from '../data/constants.js'
import { IS_DEMO } from '../services/api.js'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/demoAccounts.js'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

const tab = ref('login')
const showPassword = ref(false)
const showConfirm = ref(false)
const submitError = ref('')
const successMessage = ref('')
const errors = reactive({})
const demoAccounts = ref([])
const loadingAccounts = ref(false)
const accountsLoaded = ref(false)

const loginForm = reactive({
  email: '',
  password: '',
  remember: true,
})

const registerForm = reactive({
  nombre: '',
  apellido: '',
  curso: '',
  email: '',
  password: '',
  confirm: '',
  accept: false,
})

const currentYear = new Date().getFullYear()

const submitting = computed(() => auth.state.loading)

function clearErrors() {
  Object.keys(errors).forEach((key) => delete errors[key])
  submitError.value = ''
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
}

function validateLogin() {
  clearErrors()
  let ok = true
  if (!loginForm.email.trim()) {
    errors.email = 'Ingresá tu correo.'
    ok = false
  } else if (!validateEmail(loginForm.email)) {
    errors.email = 'El correo no tiene un formato válido.'
    ok = false
  }
  if (!loginForm.password) {
    errors.password = 'Ingresá tu contraseña.'
    ok = false
  }
  return ok
}

function validateRegister() {
  clearErrors()
  let ok = true
  if (!registerForm.nombre.trim()) {
    errors.nombre = 'Ingresá tu nombre.'
    ok = false
  } else if (registerForm.nombre.trim().length < 2) {
    errors.nombre = 'El nombre debe tener al menos 2 caracteres.'
    ok = false
  }
  if (!registerForm.apellido.trim()) {
    errors.apellido = 'Ingresá tu apellido.'
    ok = false
  }
  if (!registerForm.curso) {
    errors.curso = 'Elegí tu curso.'
    ok = false
  }
  if (!registerForm.email.trim()) {
    errors.email = 'Ingresá tu correo.'
    ok = false
  } else if (!validateEmail(registerForm.email)) {
    errors.email = 'El correo no tiene un formato válido.'
    ok = false
  }
  if (!registerForm.password) {
    errors.password = 'Creá una contraseña.'
    ok = false
  } else if (registerForm.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.'
    ok = false
  } else if (!/[A-Za-z]/.test(registerForm.password) || !/\d/.test(registerForm.password)) {
    errors.password = 'Usá al menos una letra y un número.'
    ok = false
  }
  if (registerForm.confirm !== registerForm.password) {
    errors.confirm = 'Las contraseñas no coinciden.'
    ok = false
  }
  if (!registerForm.accept) {
    errors.accept = 'Tenés que aceptar el compromiso de cuidado de los útiles.'
    ok = false
  }
  return ok
}

async function handleLogin() {
  if (!validateLogin()) return
  submitError.value = ''
  try {
    await auth.login({
      email: loginForm.email,
      password: loginForm.password,
      remember: loginForm.remember,
    })
    notify(`¡Hola, ${auth.state.user.nombre}! Ya podés usar la cooperativa.`, 'success')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (error) {
    submitError.value = error.message
  }
}

async function handleRegister() {
  if (!validateRegister()) return
  submitError.value = ''
  try {
    const result = await auth.register({
      nombre: registerForm.nombre,
      apellido: registerForm.apellido,
      curso: registerForm.curso,
      email: registerForm.email,
      password: registerForm.password,
    })
    if (result.needsConfirmation) {
      successMessage.value = result.message
      tab.value = 'login'
      loginForm.email = registerForm.email
      notify('Cuenta creada. Revisá tu correo para confirmarla.', 'success')
      return
    }
    notify(`¡Bienvenido/a, ${auth.state.user.nombre}! Tu cuenta ya está activa.`, 'success')
    router.push('/')
  } catch (error) {
    submitError.value = error.message
  }
}

async function enterDemo() {
  submitError.value = ''
  try {
    await auth.login({ email: 'ana@coop.demo', password: DEMO_PASSWORD, remember: true })
    notify('Entraste a la demostración como Ana Pérez, estudiante de 3.º B.', 'info')
    router.push('/')
  } catch (error) {
    submitError.value = error.message
  }
}

async function loadDemoAccounts() {
  if (accountsLoaded.value || !IS_DEMO) return
  loadingAccounts.value = true
  try {
    demoAccounts.value = await auth.demoAccounts()
    accountsLoaded.value = true
  } catch (error) {
    submitError.value = error.message
  } finally {
    loadingAccounts.value = false
  }
}

function useDemoAccount(account) {
  loginForm.email = account.email
  loginForm.password = DEMO_PASSWORD
  loginForm.remember = true
  tab.value = 'login'
  notify(`Cuenta de ${account.nombre} ${account.apellido} cargada. Presioná Ingresar.`, 'info')
}

function switchTab(next) {
  tab.value = next
  clearErrors()
  successMessage.value = ''
}
</script>

<template>
  <main class="login-page">
    <div class="login-shell">
      <section class="login-hero">
        <div class="login-hero__brand">
          <span class="brand__mark brand__mark--large" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
              <rect width="48" height="48" rx="14" fill="currentColor" opacity=".16" />
              <path d="M33.5 13.5C24 14 16 18.5 15 27.5c-.4 3.6 2.2 6.4 5.9 6.4 8.8 0 12.1-9.6 12.6-20.4Z" fill="currentColor" />
              <path d="M15.5 35c1.5-6.5 5.5-10.4 11.5-13.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Organización y métodos · {{ currentYear }}</p>
            <h1>Cooperativa de Útiles Escolares</h1>
          </div>
        </div>

        <p class="login-hero__lead">
          Prestamos, intercambiamos y reutilizamos los útiles que ya tenemos.
          Una cooperativa hecha por estudiantes para que nadie se quede sin lo necesario en clase.
        </p>

        <div class="login-hero__features">
          <article>
            <span aria-hidden="true">↺</span>
            <div>
              <strong>Préstamos de hasta 7 días</strong>
              <p>Pedí desde el catálogo y registrá la devolución en línea.</p>
            </div>
          </article>
          <article>
            <span aria-hidden="true">＋</span>
            <div>
              <strong>Donación e intercambio</strong>
              <p>Ofrecé útiles que ya no uses y sumalos a la cooperativa.</p>
            </div>
          </article>
          <article>
            <span aria-hidden="true">▥</span>
            <div>
              <strong>Decisiones compartidas</strong>
              <p>Votá, consultá acuerdos y seguí el impacto del trimestre.</p>
            </div>
          </article>
        </div>

        <div class="login-hero__goal">
          <p class="eyebrow">Meta del trimestre</p>
          <p><strong>90 %</strong> de solicitudes atendidas y <strong>85 %</strong> de devoluciones en plazo.</p>
        </div>

        <p class="login-hero__note">
          {{ IS_DEMO
            ? 'Estás en modo demostración: los datos se guardan solo en este navegador.'
            : 'Conectado a Supabase. Los datos se comparten entre integrantes.' }}
        </p>
      </section>

      <section class="login-card" aria-labelledby="auth-title">
        <div class="tabs" role="tablist" aria-label="Ingresar o crear cuenta">
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': tab === 'login' }"
            :aria-selected="tab === 'login'"
            @click="switchTab('login')"
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': tab === 'register' }"
            :aria-selected="tab === 'register'"
            @click="switchTab('register')"
          >
            Crear cuenta
          </button>
        </div>

        <div v-if="successMessage" class="alert alert--success" role="status">
          {{ successMessage }}
        </div>
        <div v-if="submitError" class="alert alert--error" role="alert">
          {{ submitError }}
        </div>

        <form v-if="tab === 'login'" class="auth-form" novalidate @submit.prevent="handleLogin">
          <div class="form-intro">
            <h2 id="auth-title">Hola de nuevo</h2>
            <p>Ingresá con tu correo y contraseña para continuar.</p>
          </div>

          <div class="field">
            <label for="login-email">Correo</label>
            <input
              id="login-email"
              v-model="loginForm.email"
              class="input"
              type="email"
              autocomplete="email"
              placeholder="nombre@escuela.edu"
              :aria-invalid="Boolean(errors.email)"
            />
            <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
          </div>

          <div class="field">
            <label for="login-password">Contraseña</label>
            <div class="input-with-action">
              <input
                id="login-password"
                v-model="loginForm.password"
                class="input"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Tu contraseña"
                :aria-invalid="Boolean(errors.password)"
              />
              <button type="button" class="input-action" @click="showPassword = !showPassword">
                {{ showPassword ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
            <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
          </div>

          <label class="checkbox-row">
            <input v-model="loginForm.remember" type="checkbox" />
            <span>Mantener la sesión iniciada en este dispositivo</span>
          </label>

          <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
            <span v-if="submitting" class="spinner spinner--sm" aria-hidden="true"></span>
            {{ submitting ? 'Ingresando…' : 'Ingresar' }}
          </button>

          <template v-if="IS_DEMO">
            <div class="divider"><span>o</span></div>

            <button type="button" class="btn btn-demo btn-block" @click="enterDemo">
              Entrar sin cuenta (demo)
            </button>
          </template>

          <details v-if="IS_DEMO" class="demo-accounts" @toggle="loadDemoAccounts">
            <summary>Ver cuentas de prueba</summary>
            <p class="hint">
              Contraseña para todas: <code>{{ DEMO_PASSWORD }}</code>. Después podés cambiar de rol
              desde la barra de demostración.
            </p>
            <div v-if="loadingAccounts" class="small-loading">
              <span class="spinner spinner--sm" aria-hidden="true"></span> Cargando cuentas…
            </div>
            <div v-else class="demo-account-list">
              <button
                v-for="account in demoAccounts"
                :key="account.id"
                type="button"
                class="demo-account"
                @click="useDemoAccount(account)"
              >
                <span>
                  <strong>{{ account.nombre }} {{ account.apellido }}</strong>
                  <small>{{ account.curso }}</small>
                </span>
                <span class="demo-account__role">{{ ROLES[account.rol]?.short }}</span>
              </button>
              <button
                v-for="account in DEMO_ACCOUNTS.filter((a) => !demoAccounts.some((d) => d.email === a.email))"
                :key="account.email"
                type="button"
                class="demo-account"
                @click="useDemoAccount(account)"
              >
                <span>
                  <strong>{{ account.nombre }} {{ account.apellido }}</strong>
                  <small>{{ account.curso }}</small>
                </span>
                <span class="demo-account__role">{{ ROLES[account.rol]?.short }}</span>
              </button>
            </div>
          </details>
        </form>

        <form v-else class="auth-form" novalidate @submit.prevent="handleRegister">
          <div class="form-intro">
            <h2>Crear cuenta</h2>
            <p>Sumate a la cooperativa. Todos los registros comienzan como estudiantes integrantes.</p>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="reg-nombre">Nombre</label>
              <input
                id="reg-nombre"
                v-model="registerForm.nombre"
                class="input"
                type="text"
                autocomplete="given-name"
                placeholder="Ana"
                :aria-invalid="Boolean(errors.nombre)"
              />
              <p v-if="errors.nombre" class="field-error">{{ errors.nombre }}</p>
            </div>
            <div class="field">
              <label for="reg-apellido">Apellido</label>
              <input
                id="reg-apellido"
                v-model="registerForm.apellido"
                class="input"
                type="text"
                autocomplete="family-name"
                placeholder="Pérez"
                :aria-invalid="Boolean(errors.apellido)"
              />
              <p v-if="errors.apellido" class="field-error">{{ errors.apellido }}</p>
            </div>
          </div>

          <div class="field">
            <label for="reg-curso">Curso</label>
            <select
              id="reg-curso"
              v-model="registerForm.curso"
              class="select"
              :aria-invalid="Boolean(errors.curso)"
            >
              <option value="" disabled>Elegí tu curso</option>
              <option v-for="curso in CURSOS" :key="curso" :value="curso">{{ curso }}</option>
            </select>
            <p v-if="errors.curso" class="field-error">{{ errors.curso }}</p>
          </div>

          <div class="field">
            <label for="reg-email">Correo</label>
            <input
              id="reg-email"
              v-model="registerForm.email"
              class="input"
              type="email"
              autocomplete="email"
              placeholder="nombre@escuela.edu"
              :aria-invalid="Boolean(errors.email)"
            />
            <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="reg-password">Contraseña</label>
              <div class="input-with-action">
                <input
                  id="reg-password"
                  v-model="registerForm.password"
                  class="input"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  :aria-invalid="Boolean(errors.password)"
                />
                <button type="button" class="input-action" @click="showPassword = !showPassword">
                  {{ showPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
              <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
            </div>
            <div class="field">
              <label for="reg-confirm">Repetir contraseña</label>
              <div class="input-with-action">
                <input
                  id="reg-confirm"
                  v-model="registerForm.confirm"
                  class="input"
                  :type="showConfirm ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Repetí la contraseña"
                  :aria-invalid="Boolean(errors.confirm)"
                />
                <button type="button" class="input-action" @click="showConfirm = !showConfirm">
                  {{ showConfirm ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
              <p v-if="errors.confirm" class="field-error">{{ errors.confirm }}</p>
            </div>
          </div>

          <label class="checkbox-row checkbox-row--top">
            <input v-model="registerForm.accept" type="checkbox" />
            <span>
              Me comprometo a cuidar los útiles, devolverlos en el plazo acordado y avisar si se
              pierden o se dañan.
            </span>
          </label>
          <p v-if="errors.accept" class="field-error">{{ errors.accept }}</p>

          <p class="hint hint--boxed">
            {{ IS_DEMO
              ? 'En la demo, después de registrarte podés probar otros roles con el selector "Cambiar de rol".'
              : 'En la versión con Supabase, todos ingresan como estudiantes. Solo presidencia puede asignar otros roles.' }}
          </p>

          <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
            <span v-if="submitting" class="spinner spinner--sm" aria-hidden="true"></span>
            {{ submitting ? 'Creando cuenta…' : 'Crear mi cuenta' }}
          </button>
        </form>

        <p class="login-card__foot">
          Al usar la cooperativa aceptás las pautas de cuidado y devolución acordadas por la asamblea.
        </p>
      </section>
    </div>
    <p class="login-footer">
      Proyecto escolar · Cooperativa de Útiles Escolares ·
      {{ IS_DEMO ? 'Datos ficticios · No uses contraseñas reales en la demo.' : 'Datos protegidos con Supabase.' }}
    </p>
  </main>
</template>
