import Mark from './Mark'

// Premium branded loading spinner: the brand mark inside a rotating gold/teal ring.
export default function Loader({ label, dark }) {
  return (
    <div className={'loader' + (dark ? ' dark' : '')}>
      <div className="loader-orb"><Mark /></div>
      {label && <p className="loader-txt">{label}</p>}
    </div>
  )
}
