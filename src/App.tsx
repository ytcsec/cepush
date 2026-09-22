import { CircuitCall } from './components/CircuitCall';
import { DeployPanel } from './components/DeployPanel';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './hooks/useWallet';
import { CONTRACT_ADDRESS, isDeployed } from './lib/contract';

export default function App() {
  const wallet = useWallet();

  return (
    <div className="shell">
      <header className="masthead">
        <h1>cepush</h1>
        <p className="tagline">Private, verifiable voting for communities.</p>
      </header>

      <main>
        <WalletConnect {...wallet} />
        <DeployPanel session={wallet.session} />
        <CircuitCall session={wallet.session} />
      </main>

      <footer className="footer">
        <p>
          Network <strong>{wallet.networkId}</strong>
          {isDeployed() ? (
            <>
              {' · '}contract <code>{CONTRACT_ADDRESS}</code>
            </>
          ) : (
            <> · contract not deployed yet</>
          )}
        </p>
        <p className="muted">
          The tally is public so anyone can check it. The ballot is not, and never leaves your
          device.
        </p>
      </footer>
    </div>
  );
}
