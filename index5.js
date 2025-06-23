
//https://consultas.anvisa.gov.br/#/medicamentos/
const moment = require('moment');
const bulario = require('./src');
var fs = require('fs');
const http = require('https'); // or 'https' for https:// URLs
const mysql = require('mysql2/promise');

var dir = 'NOVASAIDA';
var dirOld = 'AGRUPAMENTO';

var naoEncontrados = 0;

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// Read and parse the JSON file
const formaFarmaceuticaData = JSON.parse(fs.readFileSync('formaFarmaceutica_updated_novo.json', 'utf8'));


(async () => {
    const connection = await mysql.createConnection({
        host: '192.168.0.1',
        user: 'databaseUser',
        password: 'databasePassword',
        database: 'iapolis'
    });

    //const [medicamentosIapolis] = await connection.execute('SELECT * FROM iapolis.medicamento WHERE codMedicamento IN (SELECT codMedicamento FROM prescricao);');
    //const [medicamentosIapolis] = await connection.execute('SELECT * FROM iapolis.medicamento WHERE codMedicamento IN (SELECT codMedicamento FROM prescricao) AND codMedicamento NOT IN (SELECT codMedicamento FROM medicamentoAnvisa);');
    //const [medicamentosIapolis] = await connection.execute('SELECT * FROM medicamento WHERE codMedicamento IN (1591)');
    const [medicamentosIapolis] = await connection.execute('SELECT codMedicamento,"	SULFATO DE GENTAMICINA" as noPrincipioAtivo FROM medicamento WHERE codMedicamento = 767');
    //const [medicamentosIapolis] = await connection.execute('SELECT * FROM medicamento ORDER BY RAND()');
    

    for (var aux = 0; aux < medicamentosIapolis.length; aux++) {

        var totalPaginas = 1;
        var pagina = 1;
        do {

            await sleep(500);

            const idsList = getIdsForFormaFarmaceutica(medicamentosIapolis[aux].codFormaFarmaceutica);
            //idsList = "";

            const buscaPrincipioAtivo = await bulario.pesquisaPrincipioAtivo(encodeURIComponent(inverterEAdicionarDe(medicamentosIapolis[aux].noPrincipioAtivo)));            
            if(buscaPrincipioAtivo?.totalPages)
            {
                for (var aux3 = 0; aux3 < buscaPrincipioAtivo.content?.length; aux3++) {
                    const busca = await bulario.pesquisarPeloPrincipioAtivo(buscaPrincipioAtivo.content[aux3].id, pagina, idsList);
                    if (busca?.totalPages) {
                        totalPaginas = busca.totalPages;
                        console.log(medicamentosIapolis[aux].noPrincipioAtivo)
                        // console.log(busca);
                        for (var aux2 = 0; aux2 < busca.content?.length; aux2++) {
                            if (busca?.content[aux2]?.produto?.codigo) {
                                const produto = await bulario.codigo(busca.content[aux2].produto.codigo);
                                await sleep(250);
                                if (produto?.codigoBulaPaciente) {
                                    const bula_paciente = await bulario.getBula(produto.codigoBulaPaciente);
                                    await sleep(250);

                                    produto.numeroRegistro

                                    //console.log(produto)
                                    //console.log(bula_paciente)

                                    const idProduto = busca.content[aux2].produto.codigo;
                                    const filePath = `${dir}\\${idProduto}.pdf`;
                                    const filePathOld = `${dirOld}\\${busca.content[aux2].produto.numeroRegistro}.pdf`;

                                    const apresentacao = getApresentacoes(produto);
                                    //console.log(apresentacao);
                                    const principiosAtivos = getPrincipiosAtivos(produto);
                                    //console.log(principiosAtivos);
                                    const viasAdministracao = getViasAdministracao(produto);
                                    //console.log(viasAdministracao);
                                    const dataAtual = moment().format('YYYY-MM-DD HH:mm:ss');
                                    //console.log(dataAtual);

                                    const numeroRegistro = busca.content[aux2].produto.numeroRegistro;
                                    const nomeProduto = busca.content[aux2].produto.nome;
                                    const principioAtivo = busca.content[aux2].produto.principioAtivo;
                                    const numProcesso = busca.content[aux2].processo.numero;
                                    const categoriaRegulatoria = busca.content[aux2].produto.categoriaRegulatoria.descricao;
                                    const razaoSocial = busca.content[aux2].empresa.razaoSocial;
                                    const cnpj = busca.content[aux2].empresa.cnpj;
                                    const dataRegistro = busca.content[aux2].produto.dataRegistro;
                                    const dataVencimentoRegistro = busca.content[aux2].produto.dataVencimentoRegistro;
                                    const codMedicamento = medicamentosIapolis[aux].codMedicamento;

                                    if (!fs.existsSync(filePath) && !fs.existsSync(filePathOld)) {
                                        console.log("Arquivo nao existe " + idProduto)
                                        await downloadFile(bula_paciente,
                                            filePath,
                                            idProduto,
                                            connection,
                                            numeroRegistro,
                                            nomeProduto,
                                            principioAtivo,
                                            numProcesso,
                                            categoriaRegulatoria,
                                            apresentacao,
                                            principiosAtivos,
                                            viasAdministracao,
                                            razaoSocial,
                                            cnpj,
                                            dataRegistro,
                                            dataVencimentoRegistro,
                                            codMedicamento);

                                    } else {
                                        if (!fs.existsSync(filePath) && fs.existsSync(filePathOld)) {
                                            console.log("COPIADO DO ANTIGO ", filePathOld, filePath)
                                            fs.copyFileSync(filePathOld, filePath);
                                        } else if (fs.existsSync(filePath)) {
                                            console.log("Arquivo ja existe " + idProduto)
                                        }

                                        const [anvisaJaCadastrados] = await connection.execute('SELECT * FROM anvisa WHERE idProduto = ?', [idProduto]);
                                        if (anvisaJaCadastrados.length === 0) {
                                            console.log("Inserido anvisa")
                                            await connection.execute('INSERT INTO anvisa (idProduto, numeroRegistro, nomeProduto,principioAtivo,numProcesso,categoriaRegulatoria,apresentacao,principiosAtivos,viasAdministracao,razaoSocial,cnpj,dataRegistro,dataVencimentoRegistro,dataAtualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [idProduto, numeroRegistro, nomeProduto, principioAtivo, numProcesso, categoriaRegulatoria, apresentacao, principiosAtivos, viasAdministracao, razaoSocial, cnpj, dataRegistro, dataVencimentoRegistro, dataAtual]);
                                            await connection.execute('INSERT INTO medicamentoAnvisa (idProduto,codMedicamento) VALUES (?, ?)', [idProduto, codMedicamento]);
                                        } else {
                                            console.log("Inserido medicamentoAnvisa")
                                            const [medicamentoAnvisa] = await connection.execute('SELECT * FROM medicamentoAnvisa WHERE idProduto = ? AND codMedicamento = ?', [idProduto, codMedicamento]);
                                            if (medicamentoAnvisa.length === 0) {
                                                await connection.execute('INSERT INTO medicamentoAnvisa (idProduto,codMedicamento) VALUES (?, ?)', [idProduto, codMedicamento]);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else {
                        const busca = await bulario.pesquisar2(encodeURIComponent(separar(medicamentosIapolis[aux].noPrincipioAtivo)), pagina, idsList);
                        if (busca?.totalPages) {
                            totalPaginas = busca.totalPages;
                            console.log(medicamentosIapolis[aux].noPrincipioAtivo)
                            // console.log(busca);
                            for (var aux2 = 0; aux2 < busca.content?.length; aux2++) {
                                if (busca?.content[aux2]?.produto?.codigo) {
                                    const produto = await bulario.codigo(busca.content[aux2].produto.codigo);
                                    await sleep(250);
                                    if (produto?.codigoBulaPaciente) {
                                        const bula_paciente = await bulario.getBula(produto.codigoBulaPaciente);
                                        await sleep(250);
            
                                        produto.numeroRegistro
            
                                        //console.log(produto)
                                        //console.log(bula_paciente)
            
                                        const idProduto = busca.content[aux2].produto.codigo;
                                        const filePath = `${dir}\\${idProduto}.pdf`;
                                        const filePathOld = `${dirOld}\\${busca.content[aux2].produto.numeroRegistro}.pdf`;
            
                                        const apresentacao = getApresentacoes(produto);
                                        //console.log(apresentacao);
                                        const principiosAtivos = getPrincipiosAtivos(produto);
                                        //console.log(principiosAtivos);
                                        const viasAdministracao = getViasAdministracao(produto);
                                        //console.log(viasAdministracao);
                                        const dataAtual = moment().format('YYYY-MM-DD HH:mm:ss');
                                        //console.log(dataAtual);
            
                                        const numeroRegistro = busca.content[aux2].produto.numeroRegistro;
                                        const nomeProduto = busca.content[aux2].produto.nome;
                                        const principioAtivo = busca.content[aux2].produto.principioAtivo;
                                        const numProcesso = busca.content[aux2].processo.numero;
                                        const categoriaRegulatoria = busca.content[aux2].produto.categoriaRegulatoria.descricao;
                                        const razaoSocial = busca.content[aux2].empresa.razaoSocial;
                                        const cnpj = busca.content[aux2].empresa.cnpj;
                                        const dataRegistro = busca.content[aux2].produto.dataRegistro;
                                        const dataVencimentoRegistro = busca.content[aux2].produto.dataVencimentoRegistro;
                                        const codMedicamento = medicamentosIapolis[aux].codMedicamento;
            
                                        if (!fs.existsSync(filePath) && !fs.existsSync(filePathOld)) {
                                            console.log("Arquivo nao existe " + idProduto)
                                            await downloadFile(bula_paciente,
                                                filePath,
                                                idProduto,
                                                connection,
                                                numeroRegistro,
                                                nomeProduto,
                                                principioAtivo,
                                                numProcesso,
                                                categoriaRegulatoria,
                                                apresentacao,
                                                principiosAtivos,
                                                viasAdministracao,
                                                razaoSocial,
                                                cnpj,
                                                dataRegistro,
                                                dataVencimentoRegistro,
                                                codMedicamento);
            
                                        } else {
                                            if (!fs.existsSync(filePath) && fs.existsSync(filePathOld)) {
                                                console.log("COPIADO DO ANTIGO ", filePathOld, filePath)
                                                fs.copyFileSync(filePathOld, filePath);
                                            } else if (fs.existsSync(filePath)) {
                                                console.log("Arquivo ja existe " + idProduto)
                                            }
            
                                            const [anvisaJaCadastrados] = await connection.execute('SELECT * FROM anvisa WHERE idProduto = ?', [idProduto]);
                                            if (anvisaJaCadastrados.length === 0) {
                                                console.log("Inserido anvisa")
                                                await connection.execute('INSERT INTO anvisa (idProduto, numeroRegistro, nomeProduto,principioAtivo,numProcesso,categoriaRegulatoria,apresentacao,principiosAtivos,viasAdministracao,razaoSocial,cnpj,dataRegistro,dataVencimentoRegistro,dataAtualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [idProduto, numeroRegistro, nomeProduto, principioAtivo, numProcesso, categoriaRegulatoria, apresentacao, principiosAtivos, viasAdministracao, razaoSocial, cnpj, dataRegistro, dataVencimentoRegistro, dataAtual]);
                                                await connection.execute('INSERT INTO medicamentoAnvisa (idProduto,codMedicamento) VALUES (?, ?)', [idProduto, codMedicamento]);
                                            } else {
                                                console.log("Inserido medicamentoAnvisa")
                                                const [medicamentoAnvisa] = await connection.execute('SELECT * FROM medicamentoAnvisa WHERE idProduto = ? AND codMedicamento = ?', [idProduto, codMedicamento]);
                                                if (medicamentoAnvisa.length === 0) {
                                                    await connection.execute('INSERT INTO medicamentoAnvisa (idProduto,codMedicamento) VALUES (?, ?)', [idProduto, codMedicamento]);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            console.log("Medicamento não encontrado: " + inverterEAdicionarDe(medicamentosIapolis[aux].noPrincipioAtivo))
                            naoEncontrados++;
            
                            
                        }

                        
                    }
                }
            }            
            //console.log(busca);
            pagina++;
        } while (pagina < totalPaginas);
    }

    console.log("TOTAL DE NAO ENCONTRADOS " + naoEncontrados)
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");
    console.log("FIM");

})();

// Function to get IDs list for a given codFormaFarmaceutica
function getIdsForFormaFarmaceutica(codFormaFarmaceutica) {
    
    const codigos = String(codFormaFarmaceutica).split('#'); 
    
    const ids = formaFarmaceuticaData.filter(item => codigos.includes(item.codFormaFarmaceutica))
        .map(item => item.id);   
    
    return ids.join(',');
}

// Função para pegar os itens de apresentacao e separar por vírgula
function getApresentacoes(produto) {
    if (!produto.apresentacoes || !Array.isArray(produto.apresentacoes)) {
        return '';
    }

    const apresentacoes = produto.apresentacoes.map(apres => apres.apresentacao);
    return apresentacoes.join(';');
}

function getPrincipiosAtivos(produto) {
    if (!produto.apresentacoes || !Array.isArray(produto.apresentacoes)) {
        return '';
    }

    const principiosAtivos = produto.apresentacoes.flatMap(apres => apres.principiosAtivos);
    return principiosAtivos.join(';');
}

function getViasAdministracao(produto) {
    if (!produto.apresentacoes || !Array.isArray(produto.apresentacoes)) {
        return '';
    }

    const viasAdministracao = produto.apresentacoes.flatMap(apres => apres.viasAdministracao);
    return viasAdministracao.join(';');
}

function inverterEAdicionarDe(nome) {
    // Separar as combinações de compostos
    const compostos = nome.split('+').map(parte => parte.trim());

    // Função para inverter e adicionar "de" quando necessário
    function inverterComposto(composto) {
        const partes = composto.split(',').map(parte => parte.trim());
        if (partes.length === 2) {
            return `${partes[1]} de ${partes[0]}`;
        }
        return composto; // Retorna o composto original se não estiver no formato esperado
    }

    // Aplicar a inversão a cada composto e verificar se precisa da transformação "de"
    const compostosInvertidos = compostos.map(inverterComposto);

    // Reunir os compostos novamente com o "+"
    return compostosInvertidos.join(' + ');
}

function separar(nome) {
    // Separar as combinações de compostos
    const compostos = nome.split('+').map(parte => parte.trim());

    // Função para inverter e adicionar "de" quando necessário
    function inverterComposto(composto) {
        const partes = composto.split(',').map(parte => parte.trim());
        if (partes.length === 2) {
            return `${partes[0]} ${partes[1]}`;
        }
        return composto; // Retorna o composto original se não estiver no formato esperado
    }

    // Aplicar a inversão a cada composto e verificar se precisa da transformação "de"
    const compostosInvertidos = compostos.map(inverterComposto);

    // Reunir os compostos novamente com o "+"
    return compostosInvertidos.join(' + ');
}

async function downloadFile(url, filePath, idProduto, connection, numeroRegistro, nomeProduto, principioAtivo, numProcesso, categoriaRegulatoria, apresentacao, principiosAtivos, viasAdministracao, razaoSocial, cnpj, dataRegistro, dataVencimentoRegistro, codMedicamento, attempt = 1) {
    const maxAttempts = 4;

    await sleep(10000 * attempt);

    const file = fs.createWriteStream(filePath);
    const request = http.get(url, function (response) {
        if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
            console.log(`Attempt ${attempt}: Expected file but received JSON. Retrying... ` + idProduto);
            file.close();
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (attempt < maxAttempts) {
                downloadFile(url, filePath, idProduto, connection, numeroRegistro, nomeProduto, principioAtivo, numProcesso, categoriaRegulatoria, apresentacao, principiosAtivos, viasAdministracao, razaoSocial, cnpj, dataRegistro, dataVencimentoRegistro, codMedicamento, attempt + 1);
            } else {
                console.log('Max attempts reached. Download failed. ' + idProduto);
            }
            return;
        }

        response.pipe(file);

        file.on("finish", async () => {
            file.close(async () => {
                console.log(`\n idProduto: ${idProduto}`);
                console.log("Download Completed: " + filePath);

                const dataAtual = moment().format('YYYY-MM-DD HH:mm:ss');

                try {
                    await connection.execute('INSERT INTO anvisa (idProduto, numeroRegistro, nomeProduto,principioAtivo,numProcesso,categoriaRegulatoria,apresentacao,principiosAtivos,viasAdministracao,razaoSocial,cnpj,dataRegistro,dataVencimentoRegistro,dataAtualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [idProduto, numeroRegistro, nomeProduto, principioAtivo, numProcesso, categoriaRegulatoria, apresentacao, principiosAtivos, viasAdministracao, razaoSocial, cnpj, dataRegistro, dataVencimentoRegistro, dataAtual]);
                    await connection.execute('INSERT INTO medicamentoAnvisa (idProduto,codMedicamento) VALUES (?, ?)', [idProduto, codMedicamento]);
                    //console.log(`Produto com idProduto ${idProduto} inserido no banco de dados.`);
                } catch (error) {
                    console.log(`Erro ao inserir no banco de dados: ${error.message}`);
                }
            });
        });
    });

    request.on('error', (err) => {
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
                console.log(`Error deleting incomplete file ${filePath}: ${unlinkErr.message}`);
            }
            console.log(`Download failed for ${filePath}: ${err.message} (id produto ${idProduto})`);
        });
    });

    file.on('error', (err) => {
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
                console.log(`Error deleting incomplete file ${filePath}: ${unlinkErr.message}`);
            }
            console.log(`File stream error for ${filePath}: ${err.message} (id produto ${idProduto})`);
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
