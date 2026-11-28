import {
  discoveryAreas,
  discoveryQuestions,
  discoveryTextLimit,
  researchAcknowledgements,
} from "@/lib/business-research";

export function DiscoveryFields({
  errors = {},
}: {
  errors?: Record<string, string>;
}) {
  return (
    <div className="record-form discovery-fields">
      {Object.entries(discoveryQuestions).map(([field, label]) => (
        <label className="span-2" key={field}>
          {label}
          <textarea
            name={field}
            rows={3}
            required
            maxLength={discoveryTextLimit}
            placeholder={
              field === "revenueModel"
                ? "For example, subscriptions or pre-revenue. Leave out financial figures."
                : field === "previousAttempts"
                  ? "You can say you haven’t tried anything yet."
                  : undefined
            }
            aria-invalid={errors[field] ? true : undefined}
            aria-describedby={errors[field] ? `discovery-${field}` : undefined}
          />
          {errors[field] && (
            <small
              className="application-field-error"
              id={`discovery-${field}`}
              aria-hidden="true"
            >
              {errors[field]}
            </small>
          )}
        </label>
      ))}
      <fieldset className="span-2 discovery-areas">
        <legend>What areas would you like us to investigate?</legend>
        {discoveryAreas.map((area) => (
          <label className="check-label" key={area}>
            <input
              type="checkbox"
              name="areas"
              value={area}
              aria-describedby={
                errors.areas ? "discovery-areas-error" : undefined
              }
            />{" "}
            {area}
          </label>
        ))}
        {errors.areas && (
          <p className="application-field-error" id="discovery-areas-error">
            {errors.areas}
          </p>
        )}
      </fieldset>
    </div>
  );
}

export function ResearchConsent({
  errors = {},
}: {
  errors?: Record<string, string>;
}) {
  return (
    <>
      {Object.entries(researchAcknowledgements).map(([name, label]) => (
        <div key={name}>
          <label className="check-label">
            <input
              type="checkbox"
              name={name}
              required
              aria-invalid={errors[name] ? true : undefined}
              aria-describedby={errors[name] ? `discovery-${name}` : undefined}
            />{" "}
            {label}
          </label>
          {errors[name] && (
            <p className="application-field-error" id={`discovery-${name}`}>
              {errors[name]}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
