import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Scale, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { AuthService } from '@/services/authService'
import { ApiError } from '@/services/httpClient'
import { useAuthStore } from '@/store'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { APP_NAME } from '@/config/env'

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email, username, or login ID is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string }; sessionExpired?: boolean })?.from?.pathname || '/'
  const sessionExpired = (location.state as { sessionExpired?: boolean })?.sessionExpired

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const result = await AuthService.login({
        identifier: data.identifier,
        password: data.password,
        rememberMe: data.rememberMe,
      })
      login(result.user, result.token, result.session, data.rememberMe)
      toast.success(`Welcome back, ${result.user.firstName}!`)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) toast.error(err.message || 'Invalid credentials')
        else if (err.status === 403) toast.error(err.message || 'Account disabled')
        else if (err.status === 422 || err.status === 400) toast.error(err.message || 'Invalid login request')
        else if (err.code === 'NETWORK' || err.code === 'TIMEOUT' || err.status === 0)
          toast.error(err.message)
        else toast.error(err.message || 'Login failed')
      } else {
        toast.error(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
              <Scale className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{APP_NAME}</h1>
              <p className="text-primary-200 text-sm">Practice Management System</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Manage your CA practice<br />with intelligence
          </h2>
          <p className="text-primary-200 text-lg max-w-md">
            GST, ITR, TDS, ROC compliance, invoicing, and client management — all in one platform.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { label: 'Clients', value: '120+' },
              { label: 'Compliance', value: '99.2%' },
              { label: 'Revenue', value: '₹2.4Cr' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-primary-200 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{APP_NAME}</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Enter your credentials to access your account
          </p>

          {sessionExpired && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
              Your session has expired. Please sign in again.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email, Username, or Login ID"
              placeholder="rajesh.sharma@smartca.in"
              icon={<Mail className="h-4 w-4" />}
              error={errors.identifier?.message}
              {...register('identifier')}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" {...register('rememberMe')} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">Admin:</span> rajesh.sharma@smartca.in</p>
              <p><span className="font-medium">Partner:</span> priya.patel@smartca.in</p>
              <p><span className="font-medium">CA:</span> amit.kumar@smartca.in</p>
              <p><span className="font-medium">Password:</span> SmartCA@2025</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
