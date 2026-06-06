import { useParams } from 'react-router-dom'
import { useDocument } from '@/features/inventory/hooks'
import { DocumentDetail } from '@/features/inventory/DocumentDetail'
import { ApprovalActions } from '@/features/inventory/ApprovalActions'

export default function AjusteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: doc } = useDocument(Number(id), 'AI')

  return (
    <DocumentDetail
      id={Number(id)}
      docType="AI"
      extraActions={doc ? <ApprovalActions doc={doc} /> : undefined}
    />
  )
}
