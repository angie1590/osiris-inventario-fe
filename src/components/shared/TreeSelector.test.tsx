import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TreeSelector } from './TreeSelector'
import type { Category } from '@/types/api'

const cats: Category[] = [
  { id: 1, name: 'Electrónica', parent_id: null, is_active: true, description: null, created_at: '', updated_at: '' },
  { id: 2, name: 'Computadoras', parent_id: 1, is_active: true, description: null, created_at: '', updated_at: '' },
  { id: 3, name: 'Laptops', parent_id: 2, is_active: true, description: null, created_at: '', updated_at: '' },
  { id: 4, name: 'Ropa', parent_id: null, is_active: true, description: null, created_at: '', updated_at: '' },
  { id: 5, name: 'Camisetas', parent_id: 4, is_active: true, description: null, created_at: '', updated_at: '' },
  { id: 6, name: 'Oculto', parent_id: null, is_active: false, description: null, created_at: '', updated_at: '' },
]

describe('TreeSelector', () => {
  it('shows placeholder when no value selected', () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Seleccionar categoría')
  })

  it('shows selected category name in trigger', () => {
    render(<TreeSelector categories={cats} value={4} onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Ropa')
  })

  it('shows full path for nested selection', () => {
    render(<TreeSelector categories={cats} value={3} onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Electrónica › Computadoras › Laptops')
  })

  it('opens popover on trigger click', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('does not show inactive categories', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByText('Oculto')).not.toBeInTheDocument()
  })

  it('calls onChange with selected id when node clicked', async () => {
    const onChange = vi.fn()
    render(<TreeSelector categories={cats} value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))

    const option = screen.getByText('Ropa')
    await userEvent.click(option)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('closes popover after selection', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('Ropa'))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('filters nodes by search query', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))

    const search = screen.getByPlaceholderText('Buscar categoría...')
    await userEvent.type(search, 'Laptops')

    expect(screen.getByText('Laptops')).toBeInTheDocument()
    expect(screen.queryByText('Ropa')).not.toBeInTheDocument()
    expect(screen.queryByText('Camisetas')).not.toBeInTheDocument()
  })

  it('keeps ancestors visible when child matches search', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))

    const search = screen.getByPlaceholderText('Buscar categoría...')
    await userEvent.type(search, 'Laptops')

    expect(screen.getByText('Electrónica')).toBeInTheDocument()
    expect(screen.getByText('Computadoras')).toBeInTheDocument()
    expect(screen.getByText('Laptops')).toBeInTheDocument()
  })

  it('clears search when popover closes', async () => {
    render(<TreeSelector categories={cats} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))

    const search = screen.getByPlaceholderText('Buscar categoría...')
    await userEvent.type(search, 'laptop')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByPlaceholderText('Buscar categoría...')).toHaveValue('')
    expect(screen.getByText('Ropa')).toBeInTheDocument()
  })

  it('shows "Sin categorías" when all categories are inactive', async () => {
    const empty = cats.map((c) => ({ ...c, is_active: false }))
    render(<TreeSelector categories={empty} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('Sin categorías')).toBeInTheDocument()
  })

  it('navigates with ArrowDown key', async () => {
    render(<TreeSelector categories={[{ id: 1, name: 'A', parent_id: null, is_active: true, description: null, created_at: '', updated_at: '' }, { id: 2, name: 'B', parent_id: null, is_active: true, description: null, created_at: '', updated_at: '' }]} value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })

    await waitFor(() => {
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('data-focused', 'true')
    })
  })

  it('selects focused node on Enter', async () => {
    const onChange = vi.fn()
    render(<TreeSelector categories={[{ id: 1, name: 'Alpha', parent_id: null, is_active: true, description: null, created_at: '', updated_at: '' }]} value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(screen.getByRole('option')).toHaveAttribute('data-focused', 'true')
    })

    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('allows selecting explicit root option', async () => {
    const onChange = vi.fn()
    render(
      <TreeSelector
        categories={cats}
        value={2}
        onChange={onChange}
        allowRootOption
        rootLabel="Sin padre / categoría raíz"
      />
    )

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('Sin padre / categoría raíz'))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
