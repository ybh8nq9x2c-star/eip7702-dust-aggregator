# EIP-7702 Dust Aggregator Tool

Tool per aggregare i fondi "dust" (spiccioli) da multiple blockchain EVM in una singola chain utilizzando il protocollo EIP-7702.

## 🚀 Caratteristiche

- Supporto per multiple chain EVM (Ethereum, Polygon, BSC, Arbitrum, Optimism)
- Scansione automatica dei balance su tutte le chain configurate
- Calcolo automatico dei costi di gas
- Aggregazione sicura dei fondi
- Report dettagliato in formato JSON

## 📋 Prerequisiti

- Python 3.8+
- Private key del wallet (NON condividere mai!)
- ETH sufficiente per coprire i costi di gas

## 🔧 Installazione

```bash
# Clona o naviga nella directory del progetto
cd eip7702-dust-aggregator

# Crea un ambiente virtuale
python3 -m venv venv
source venv/bin/activate

# Installa le dipendenze
pip install -r requirements.txt
```

## 🎯 Utilizzo

### 1. Configura le variabili d'ambiente

```bash
export PRIVATE_KEY=your_private_key_here
export TARGET_ADDRESS=your_target_address_here
```

### 2. Esegui il tool

```bash
python dust_aggregator.py
```

### 3. Visualizza il report

Il report viene salvato in `report.json`:

```bash
cat report.json
```

## 🔒 Sicurezza

- ⚠️ **NON** condividere mai la tua private key
- ⚠️ Usa sempre un ambiente di test prima di usare mainnet
- ⚠️ Verifica sempre gli indirizzi di destinazione
- ⚠️ Il tool è in modalità SIMULAZIONE per impostazione predefinita

## 📊 Chain Supportate

| Chain | Chain ID | Symbol |
|-------|----------|--------|
| Ethereum | 1 | ETH |
| Polygon | 137 | MATIC |
| BSC | 56 | BNB |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |

## 🔧 Configurazione Avanzata

Puoi aggiungere altre chain modificando il dizionario `CHAINS` nel file `dust_aggregator.py`:

```python
CHAINS = {
    'your_chain': {
        'rpc': 'https://your-rpc-url.com',
        'chain_id': 12345,
        'symbol': 'TOKEN'
    }
}
```

## 📝 EIP-7702

EIP-7702 è un nuovo standard che permette agli account di delegare il loro codice a un contratto smart. Questo tool utilizza EIP-7702 per:

1. Aggregare transazioni multiple in una singola operazione
2. Ridurre i costi di gas complessivi
3. Semplificare la gestione dei fondi su multiple chain

## 🐛 Troubleshooting

### Errore: "No chains connected"
- Verifica la connessione internet
- Controlla che gli endpoint RPC siano corretti

### Errore: "Balance too low to cover gas"
- Il balance è inferiore al costo del gas necessario per la transazione
- Aggiungi fondi al wallet o ignora quella chain

### Errore: "Invalid private key"
- Verifica che la private key sia corretta
- Assicurati di non aver incluso "0x" all'inizio

## 📄 Licenza

MIT License - Usa questo codice a tuo rischio e pericolo.

## ⚠️ Disclaimer

Questo tool è fornito "così com'è" senza garanzie di alcun tipo. L'autore non è responsabile per perdite di fondi o danni derivanti dall'uso di questo software.
