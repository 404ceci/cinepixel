import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useMovieModal } from '../hooks/useMovieModal'
import { useTheme } from '../theme'
import { MovieModal } from './MovieModal'

export function Layout() {
  const { openId, close } = useMovieModal()
  const { theme, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const location = useLocation()
  const onLogin = location.pathname === '/login'
  const next = encodeURIComponent(location.pathname + location.search)

  return (
    <>
      <div className="beam" aria-hidden="true" />
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="header">
        <div className="container header__inner">
          <Link to="/" className="brand" aria-label="CinePixel home">
            <span className="brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="brand__name">
              cine<b>pixel</b>
            </span>
          </Link>

          <nav className="nav" aria-label="Main">
            <NavLink to="/" end className="nav__link">
              Search
            </NavLink>
            <NavLink to="/rated" className="nav__link">
              My ratings
            </NavLink>
          </nav>

          <div className="toolbar">
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {user ? (
              <div className="account">
                <span className="account__avatar" aria-hidden="true">
                  {user.email.charAt(0).toUpperCase()}
                </span>
                <span className="account__email" title={user.email}>
                  {user.email}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : (
              !onLogin && (
                <Link to={`/login?next=${next}`} className="btn btn--primary btn--sm">
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      <main id="content" className="container main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <p className="footer__text">© CinePixel. Made by Cecília Pacheco. Film data from TMDB.</p>
        </div>
      </footer>

      {openId !== null && <MovieModal key={openId} movieId={openId} onClose={close} />}
    </>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  )
}
