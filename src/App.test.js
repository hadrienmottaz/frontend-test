import { render, screen } from '@testing-library/react';
import App from './App';

test('renders React Image Components header', () => {
  render(<App />);
  const headerElement = screen.getByText(/React Image Components/i);
  expect(headerElement).toBeInTheDocument();
});

test('renders ImageUploader component', () => {
  render(<App />);
  const uploaderElement = screen.getByText(/Image Uploader/i);
  expect(uploaderElement).toBeInTheDocument();
});

test('renders ImageDisplay component', () => {
  render(<App />);
  const displayElement = screen.getByText(/Image Display with Rectangle Overlay/i);
  expect(displayElement).toBeInTheDocument();
});
