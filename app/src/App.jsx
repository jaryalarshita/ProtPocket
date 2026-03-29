import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ComplexDetailPage } from './pages/ComplexDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { Footer } from './components/layout/Footer';

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-bg-primary font-body text-text-primary selection:bg-accent-dim selection:text-accent">
        <Navbar />
        <main className="flex-1 flex flex-col items-center w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/complex/:id" element={<ComplexDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
