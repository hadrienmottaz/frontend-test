import './App.css';
import ImageUploader from './components/ImageUploader';
import ImageDisplay from './components/ImageDisplay';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>React Image Components</h1>
        <p>A collection of React components for image handling</p>
      </header>
      
      <main className="App-main">
        <ImageUploader />
        <ImageDisplay />
      </main>
    </div>
  );
}

export default App;
