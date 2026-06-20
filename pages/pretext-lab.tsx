import dynamic from 'next/dynamic'

const PretextLab = dynamic(() => import('@/components/labs/PretextLab'), {
  ssr: false,
})

export default function PretextLabPage() {
  return <PretextLab />
}
