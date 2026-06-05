import { useParams } from 'react-router-dom'
import { useDocument } from '@/features/inventory/hooks'
import { DocumentDetail } from '@/features/inventory/DocumentDetail'
import { ApprovalActions } from '@/features/inventory/ApprovalActions'

export default function BajaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: doc } = useDocument(Number(id))

  return (
    <DocumentDetail
      id={Number(id)}
      extraActions={doc ? <ApprovalActions doc={doc} /> : undefined}
    />
  )
}
