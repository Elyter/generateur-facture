const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const puppeteer = require('puppeteer');
const app = express();

// Configuration de CORS
app.use(cors());
app.use(express.json());

// Définir le répertoire des vues et le moteur de vue
app.set('views', path.join(__dirname, 'views')); // Assurez-vous que ce chemin est correct
app.set('view engine', 'ejs');

// Route pour rendre la page index.ejs
app.get('/', (req, res) => {
    res.render('index'); // Assurez-vous d'avoir un fichier index.ejs dans votre dossier views
});

// Route pour générer la facture
app.post('/generate-invoice', async (req, res) => {
    const { clientInfo, invoiceInfo, items } = req.body;

    if (!clientInfo || !invoiceInfo || !items || !invoiceInfo.recipientName || !invoiceInfo.recipientAddress) {
        return res.status(400).json({ error: 'Données de facture manquantes ou incomplètes.' });
    }

    try {
        // Créer un fichier HTML avec les données de la facture
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Facture</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 14px; }
                    .container { width: 100%; max-width: 800px; margin: auto; padding: 20px; }
                    .header, .footer { text-align: center; margin-bottom: 20px; }
                    .header { border-bottom: 2px solid #000; }
                    .footer { border-top: 2px solid #000; }
                    .sender, .recipient { margin-bottom: 20px; }
                    .sender { float: left; }
                    .recipient { float: right; }
                    .clearfix { clear: both; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    table, th, td { border: 1px solid #000; }
                    th, td { padding: 10px; text-align: left; }
                    .total { text-align: right; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><h1>Facture</h1></div>
                    <div class="sender">
                        <p><strong>Émetteur :</strong></p>
                        <p>${clientInfo.name}</p>
                        <p>${clientInfo.address}</p>
                        <p>${clientInfo.email}</p>
                        <p>Tel: ${clientInfo.phone}</p>
                        <p>N° SIRET: ${clientInfo.siret || ''}</p>
                    </div>
                    <div class="recipient">
                        <p><strong>Destinataire :</strong></p>
                        <p>${invoiceInfo.recipientName}</p>
                        <p>${invoiceInfo.recipientAddress}</p>
                        <p>${invoiceInfo.recipientCity}</p>
                        <p>Tel: ${invoiceInfo.recipientPhone}</p>
                        <p>${invoiceInfo.recipientEmail}</p>
                    </div>
                    <div class="clearfix"></div>
                    <div>
                        <p><strong>Date d'émission :</strong> ${invoiceInfo.date}</p>
                        <p><strong>Numéro de Facture :</strong> ${invoiceInfo.number}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantité</th>
                                <th>Prix unitaire HT</th>
                                <th>Total HT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
                                const quantity = parseFloat(item.quantity);
                                const unitPrice = parseFloat(item.unitPrice);
                                const total = (quantity * unitPrice).toFixed(2);
                                return `
                                    <tr>
                                        <td>${item.description}</td>
                                        <td>${quantity}</td>
                                        <td>${unitPrice.toFixed(2)} €</td>
                                        <td>${total} €</td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="total">
                        <p><strong>Total HT :</strong> ${(items.reduce((acc, item) => acc + (parseFloat(item.unitPrice) * parseFloat(item.quantity)), 0)).toFixed(2)} €</p>
                    </div>
                    <div class="footer">
                        <p>${invoiceInfo.footerText || 'TVA non applicable : Article 293 B du Code Général des Impôts'}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Utiliser Puppeteer pour convertir le HTML en PDF
        const browser = await puppeteer.launch({
            executablePath: '/home/elyter/.cache/puppeteer/chrome/linux-126.0.6478.126/chrome',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Optionnel: Pour éviter les problèmes liés à la mémoire partagée
                '--disable-gpu'            // Optionnel: Pour éviter les problèmes de rendu GPU
            ]
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();

        // Enregistrer le PDF dans un fichier
        const fileName = `invoice_${invoiceInfo.number}.pdf`;
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        // Envoyer le fichier PDF au client
        res.download(filePath, (err) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Erreur lors de la génération de la facture.' });
            }
            // Supprimer le fichier après envoi
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la génération de la facture.' });
    }
});

// Remplacez la création du serveur HTTPS par un serveur HTTP
const PORT = 5001; // Vous pouvez garder le même port ou le changer si vous préférez
app.listen(PORT, () => {
    console.log(`Serveur HTTP en cours d'exécution sur le port ${PORT}...`);
});


