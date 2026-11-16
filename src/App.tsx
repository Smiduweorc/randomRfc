import { useEffect } from 'react'
import { useRfc } from './rfc/RfcApi'
import { RfcDocument } from './rfc/RfcDocument'

function App() {
  const { rfc, error, loading, another, open, retry } = useRfc()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')
      if (event.key === 'n' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !typing) {
        another()
      }
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [another])

  const announcement = loading
    ? 'Loading an RFC'
    : rfc
      ? `RFC ${rfc.number}: ${rfc.title}`
      : error

  return (
    <>
      {rfc && <title>{`RFC ${rfc.number}: ${rfc.title}`}</title>}
      <header className="bar">
        <p className="wordmark">Random RFC</p>
        <button type="button" className="another" onClick={another}>
          Another RFC <kbd>n</kbd>
        </button>
      </header>

      <main aria-busy={loading} className={loading && rfc ? 'stale' : undefined}>
        {rfc ? (
          <RfcDocument rfc={rfc} onOpen={open} />
        ) : error ? (
          <section className="problem">
            <h1>No RFC this time</h1>
            <p>{error}</p>
            <button type="button" className="read-main" onClick={retry}>Try again</button>
          </section>
        ) : (
          <p className="pending">Picking an RFC...</p>
        )}
      </main>

      <p role="status" className="sr-only">{announcement}</p>

      <footer>
        <p>
          Metadata comes from the <a href="https://www.rfc-editor.org/">RFC Editor</a>. Some numbers were never issued, so a pick is sometimes redone behind the scenes.
        </p>
      </footer>
    </>
  )
}

export default App
