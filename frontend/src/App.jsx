import useStore from './api/store'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import ProcessingPage from './pages/ProcessingPage'
import GraphPage from './pages/GraphPage'
import GapsPage from './pages/GapsPage'

function App() {
  const { page } = useStore()

  const renderPage = () => {
    switch (page) {
      case 'upload':     return <UploadPage />
      case 'processing': return <ProcessingPage />
      case 'graph':      return <GraphPage />
      case 'gaps':       return <GapsPage />
      default:           return <UploadPage />
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>{renderPage()}</main>
    </div>
  )
}

export default App
