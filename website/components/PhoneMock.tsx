/**
 * CSS-only mockup of the Athlr recording screen: an animated route draws
 * itself across a dark map while a "runner" dot follows it, above the
 * signature giant-numeral stats panel.
 */
export default function PhoneMock() {
  return (
    <div className="phone" aria-hidden>
      <div className="phone__screen">
        <div className="phone__map">
          <svg className="phone__route" viewBox="0 0 320 260" preserveAspectRatio="none">
            <path d="M20 220 C 70 160, 60 90, 130 100 S 250 170, 290 60" />
          </svg>
          <span className="phone__runner" />
        </div>
        <div className="phone__panel">
          <p className="label">Distance · km</p>
          <div className="phone__stat">7.42</div>
          <div className="phone__row">
            <div>
              <p className="label">Moving Time</p>
              <div className="phone__small">38:12</div>
            </div>
            <div>
              <p className="label">Pace · /km</p>
              <div className="phone__small">5:09</div>
            </div>
          </div>
          <div className="phone__controls">
            <span className="phone__btn phone__btn--pause">❚❚</span>
            <span className="phone__btn phone__btn--stop">■</span>
          </div>
        </div>
      </div>
    </div>
  );
}
