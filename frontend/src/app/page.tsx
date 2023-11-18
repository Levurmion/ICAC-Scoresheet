import SignInButton from '@/components/SignInButton'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24 gap-4">
      <h1 className='text-4xl border-black border-2 border-solid'>Home Page</h1>
      <SignInButton />
    </main>
  )
}
