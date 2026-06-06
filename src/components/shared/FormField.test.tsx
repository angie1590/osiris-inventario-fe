import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FormField } from './FormField'

describe('FormField', () => {
  it('renders the label', () => {
    render(<FormField label="Email"><input /></FormField>)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows required asterisk when required=true', () => {
    render(<FormField label="Email" required><input /></FormField>)
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not show asterisk when required is omitted', () => {
    render(<FormField label="Email"><input /></FormField>)
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('renders error message when error prop is provided', () => {
    render(<FormField label="Email" error="Campo requerido"><input /></FormField>)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('renders hint when hint prop is provided', () => {
    render(<FormField label="Email" hint="Use a valid email"><input /></FormField>)
    expect(screen.getByText('Use a valid email')).toBeInTheDocument()
  })

  it('error takes precedence over hint', () => {
    render(<FormField label="Email" error="Bad input" hint="A hint"><input /></FormField>)
    expect(screen.getByText('Bad input')).toBeInTheDocument()
    expect(screen.queryByText('A hint')).not.toBeInTheDocument()
  })

  it('injects aria-invalid on child input when error is set', () => {
    render(<FormField label="Email" error="Required"><input data-testid="inp" /></FormField>)
    expect(screen.getByTestId('inp')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not inject aria-invalid when no error', () => {
    render(<FormField label="Email"><input data-testid="inp" /></FormField>)
    expect(screen.getByTestId('inp')).not.toHaveAttribute('aria-invalid')
  })

  it('injects aria-describedby linking input to error paragraph', () => {
    render(<FormField label="Email" error="Wrong"><input data-testid="inp" /></FormField>)
    const inp = screen.getByTestId('inp')
    const describedBy = inp.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const desc = document.getElementById(describedBy!)
    expect(desc).not.toBeNull()
    expect(desc?.textContent).toBe('Wrong')
  })

  it('associates label with input via htmlFor', () => {
    render(<FormField label="Username"><input data-testid="inp" /></FormField>)
    const label = screen.getByText('Username').closest('label')
    const inp = screen.getByTestId('inp')
    expect(label?.htmlFor).toBe(inp.id)
  })
})
