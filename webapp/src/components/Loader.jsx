// Premium branded loading spinner: the brand mark inside a rotating gold/teal ring.
export default function Loader({ label, dark }) {
  return (
    <div className={'loader' + (dark ? ' dark' : '')}>
      <div className="loader-orb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" /></svg>
      </div>
      {label && <p className="loader-txt">{label}</p>}
    </div>
  )
}
