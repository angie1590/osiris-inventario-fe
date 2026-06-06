import { useParams } from 'react-router-dom'
import { DocumentDetail } from '@/features/inventory/DocumentDetail'

export default function EgresoDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <DocumentDetail id={Number(id)} docType="EG" showPrice />
}
