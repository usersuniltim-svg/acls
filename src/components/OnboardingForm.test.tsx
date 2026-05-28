import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import OnboardingForm from './OnboardingForm'
import { auth, db, handleFirestoreError } from '../lib/firebase'
import { setDoc, doc } from 'firebase/firestore'

// Mock Firebase
vi.mock('../lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com'
    }
  },
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { CREATE: 'CREATE' }
}))

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mocked-timestamp')
}))

describe('OnboardingForm', () => {
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.matchMedia for motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders all form fields correctly', () => {
    render(<OnboardingForm onComplete={mockOnComplete} />)

    expect(screen.getByText('Onboarding')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Dr. John Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Doctor')).toBeInTheDocument() // "doctor" is default
    expect(screen.getByPlaceholderText('MD, MBBS, RN')).toBeInTheDocument()
    // The inputs are not linked with labels using htmlFor, so we can't use getByLabelText easily here.
    // However, we can test that the text labels exist and the inputs exist.
    expect(screen.getByText('Date of Birth')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Male')).toBeInTheDocument() // "male" is default
    expect(screen.getByPlaceholderText('REG123456789')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('+1 (555) 000-0000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complete Registration/i })).toBeInTheDocument()
  })

  it('submits form data successfully', async () => {
    const user = userEvent.setup()
    // Type definitions for mocks
    const mockedSetDoc = setDoc as unknown as ReturnType<typeof vi.fn>
    const mockedDoc = doc as unknown as ReturnType<typeof vi.fn>

    mockedSetDoc.mockResolvedValueOnce(undefined)
    mockedDoc.mockReturnValue('mocked-doc-ref')

    const { container } = render(<OnboardingForm onComplete={mockOnComplete} />)

    // Fill out the form
    await user.type(screen.getByPlaceholderText('Dr. John Doe'), 'Jane Doe')

    // Selects
    const selects = container.querySelectorAll('select')
    // First select is profession
    await user.selectOptions(selects[0], 'nurse')
    // Second select is sex
    await user.selectOptions(selects[1], 'female')

    await user.type(screen.getByPlaceholderText('MD, MBBS, RN'), 'RN')

    // For date input
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '1990-01-01' } })

    await user.type(screen.getByPlaceholderText('REG123456789'), 'REG987654')
    await user.type(screen.getByPlaceholderText('+1 (555) 000-0000'), '1234567890')

    // Submit form
    await user.click(screen.getByRole('button', { name: /Complete Registration/i }))

    await waitFor(() => {
      expect(mockedSetDoc).toHaveBeenCalledWith(
        'mocked-doc-ref',
        expect.objectContaining({
          fullName: 'Jane Doe',
          profession: 'nurse',
          highestDegree: 'RN',
          dob: '1990-01-01',
          sex: 'female',
          councilRegistration: 'REG987654',
          phone: '1234567890',
          email: 'test@example.com',
          onboardedAt: 'mocked-timestamp'
        })
      )
      expect(mockOnComplete).toHaveBeenCalled()
    })
  })

  it('handles submission errors and displays error message', async () => {
    const user = userEvent.setup()
    const mockedSetDoc = setDoc as unknown as ReturnType<typeof vi.fn>
    const mockedHandleFirestoreError = handleFirestoreError as unknown as ReturnType<typeof vi.fn>

    mockedSetDoc.mockRejectedValueOnce(new Error('Firestore error'))

    const { container } = render(<OnboardingForm onComplete={mockOnComplete} />)

    // Fill minimal required fields to enable submit if there were validation
    await user.type(screen.getByPlaceholderText('Dr. John Doe'), 'Jane Doe')
    await user.type(screen.getByPlaceholderText('MD, MBBS, RN'), 'RN')
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '1990-01-01' } })
    await user.type(screen.getByPlaceholderText('REG123456789'), 'REG987654')
    await user.type(screen.getByPlaceholderText('+1 (555) 000-0000'), '1234567890')

    // Submit form
    await user.click(screen.getByRole('button', { name: /Complete Registration/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to save profile. Please try again.')).toBeInTheDocument()
      expect(mockedHandleFirestoreError).toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })
  })
})
