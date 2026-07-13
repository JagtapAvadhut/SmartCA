import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { AuthService } from '@/services/authService'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const result = await AuthService.forgotPassword(data.email)
      setSent(true)
      toast.success(result.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Forgot password?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {sent ? 'Check your email for the reset link.' : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              placeholder="you@smartca.in"
              icon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" className="w-full" loading={loading}>Send Reset Link</Button>
          </form>
        ) : (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">We've sent a password reset link to your email.</p>
            <Link to="/login"><Button variant="outline">Return to Sign In</Button></Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}
