import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl">Página no encontrada</p>
      <Button asChild variant="outline"><Link to="/">Ir al inicio</Link></Button>
    </div>
  )
}
