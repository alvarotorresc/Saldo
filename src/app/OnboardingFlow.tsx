// OnboardingFlow — orchestrates the 4-step onboarding sequence:
//   welcome → pin-setup → biometrics → first-import → done

import { useState } from 'react';
import { WelcomePage } from '@/pages/onboarding/WelcomePage';
import { PinSetupPage } from '@/pages/onboarding/PinSetupPage';
import { BiometricsPage } from '@/pages/onboarding/BiometricsPage';
import { FirstImportPage } from '@/pages/onboarding/FirstImportPage';

type Step = 'welcome' | 'pin-setup' | 'biometrics' | 'first-import';

interface Props {
  onDone: () => void;
  onRestore?: () => void;
}

export function OnboardingFlow({ onDone, onRestore }: Props) {
  const [step, setStep] = useState<Step>('welcome');

  switch (step) {
    case 'welcome':
      return <WelcomePage onContinue={() => setStep('pin-setup')} onRestore={onRestore} />;

    case 'pin-setup':
      return (
        <PinSetupPage onComplete={() => setStep('biometrics')} onBack={() => setStep('welcome')} />
      );

    case 'biometrics':
      return <BiometricsPage onContinue={() => setStep('first-import')} />;

    case 'first-import':
      return <FirstImportPage onComplete={onDone} onSkip={onDone} />;
  }
}
