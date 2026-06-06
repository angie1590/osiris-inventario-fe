import { useParams } from 'react-router-dom'
import { DocumentDetail } from '@/features/inventory/DocumentDetail'

export default function IngresoDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <DocumentDetail id={Number(id)} docType="IN" showCost />
}
