import Link from "next/link";

type DefaultStep = {
  title: string;
};

function Stepper<T extends DefaultStep>(props: { href: string; step: number; steps: T[] }) {
  const { href, steps } = props;
  return (
    <>
      {steps.length > 1 && (
        <nav className="flex items-center justify-center" aria-label="Progress">
          <p className="text-sm font-medium">
            Step {props.step} of {steps.length}
          </p>
          <ol role="list" className="ml-8 flex items-center space-x-5">
            {steps.map((mapStep, index) => (
              <li key={mapStep.title}>
                <Link href={`${href}?step=${index + 1}`} shallow replace>
                  {index + 1 < props.step ? (
                    <a className="block h-2.5 w-2.5 rounded-full bg-gray-600 hover:bg-gray-900">
                      <span className="sr-only">{mapStep.title}</span>
                    </a>
                  ) : index + 1 === props.step ? (
                    <a className="relative flex items-center justify-center" aria-current="step">
                      <span className="absolute flex h-5 w-5 p-px" aria-hidden="true">
                        <span className="h-full w-full rounded-full bg-gray-200" />
                      </span>
                      <span
                        className="relative block h-2.5 w-2.5 rounded-full bg-gray-600"
                        aria-hidden="true"
                      />
                      <span className="sr-only">{mapStep.title}</span>
                    </a>
                  ) : (
                    <a className="block h-2.5 w-2.5 rounded-full bg-gray-200 hover:bg-gray-400">
                      <span className="sr-only">{mapStep.title}</span>
                    </a>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}

export default Stepper;
