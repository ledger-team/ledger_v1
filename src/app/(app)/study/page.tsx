import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { getStudyData } from '@/features/study/queries'
import { StudyView } from '@/features/study/components/StudyView'

export default async function StudyPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const data = await getStudyData(session)
  return <StudyView data={data} />
}
