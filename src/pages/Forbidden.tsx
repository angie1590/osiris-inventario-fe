import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function Forbidden() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <h1 className="text-3xl font-bold">Sin acceso</h1>
      <p className="text-muted-foreground">No tenés permiso para ver esta página.</p>
      <Button asChild variant="outline"><Link to="/">Ir al inicio</Link></Button>
    </div>
  )
}
