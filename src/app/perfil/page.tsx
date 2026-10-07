import { connection } from 'next/server'
import { ProfileForm } from '@/components/profile-form'
import { CV_DIR_DEFAULT } from '@/lib/config'
import { cvDir, listCvs } from '@/lib/outreach'
import { readProfile } from '@/lib/profile'

export default async function ProfilePage() {
  // Always read the saved files instead of a build-time snapshot
  await connection()
  const [profile, cvFiles, dir] = await Promise.all([
    readProfile(),
    listCvs(),
    cvDir(),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Seus dados e currículos. Ficam só nesta máquina, em data/.
      </p>
      {/* Keyed by the saved profile: a new PDF keeps unsaved edits */}
      <ProfileForm
        key={JSON.stringify(profile)}
        initial={profile}
        cvFiles={cvFiles}
        cvDir={dir}
        defaultCvDir={CV_DIR_DEFAULT}
      />
    </main>
  )
}
