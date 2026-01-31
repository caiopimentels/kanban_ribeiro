<?php
session_start();
$id_rotina = "55";
require "securety.php";

$secretPath = __DIR__ . "/kanban_secret.key";
if (!file_exists($secretPath)) {
    die("Arquivo de secret NÃO encontrado em: " . $secretPath);
}
$secret = trim(file_get_contents($secretPath));

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function gerarTokenKanban($userId, $secret, $ttlSegundos = 1800) {
    $agora = time(); 
    $exp   = $agora + $ttlSegundos; 
    $payload = $userId . ':' . $exp;
    $sig = hash_hmac('sha256', $payload, $secret, true);
    return base64url_encode($payload) . '.' . base64url_encode($sig);
}

$userId      = $_SESSION['login'];
$tokenKanban = gerarTokenKanban($userId, $secret);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="src/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css" integrity="sha512-DxV+EoADOkOygM4IR9yXP8Sb2qwgidEmeqAEmDKIOfPRQZOWbXCzLC6vjbZyy0vPisbH2SyW27+ddLVCN+OMzQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <title>Kanban - Caio</title>
</head>
<body>
    <div>
    <div style="width:100%;text-align: center;">
    <h5><?php echo $_SESSION['login']." - ".$_SESSION['nome'];?> | <a href='/sislote/'>HOME</a></h5>
    <input type="hidden" id="txtLogin" name="txtLogin" value="<?php echo $_SESSION['login']; ?>">
    </div>

    <main class="kanban">
        <!--Coluna 3-->
        <div class="kanban-column" id="lotes-bloqueados">
            <div class="kanban-title">
                <h2>
                    Bloqueados
                </h2>

                <button class="add-card">
                    <i class="fa-solid fa-filter"></i>
                </button>
                
            </div>
            <div class="kanban-cards">

            </div>
        </div> 


        <!--Coluna 1-->
        <div class="kanban-column" id="contrato-gerado">
            <div class="kanban-title">
                <h2>Contrato Gerado </h2>

                <button class="add-card">
                    <i class="fa-solid fa-filter"></i>
                </button>

                <button class="add-card create-card-btn" title="Criar Contrato Especial">
                    <i class="fa-solid fa-plus"></i>
                </button>

            </div>
            <div class="kanban-cards">
                </div>
        </div>

        <!--Coluna 2-->
        <div class="kanban-column" id="assinado-cliente">
            <div class="kanban-title">
                <h2>
                    Assinado Cliente
                </h2>

                <button class="add-card">
                    <i class="fa-solid fa-filter"></i>
                </button>
                
            </div>
            <div class="kanban-cards">

            </div>
        </div>

        <!--Coluna 4-->
        <div class="kanban-column" id="aguardando-retirada">
            <div class="kanban-title">
                <h2>
                    Aguardando Retirada
                </h2>

                <button class="add-card">
                    <i class="fa-solid fa-filter"></i>
                </button>
                
            </div>
            <div class="kanban-cards">

            </div>
        </div> 

        <!--Coluna 5-->
        <div class="kanban-column" id="entregue">
            <div class="kanban-title">
                <h2>
                    Entregue
                </h2>

                <button class="add-card" data-coluna="entregue">
                    <i class="fa-solid fa-filter"></i>
                </button>
                
            </div>
            <div class="kanban-cards">

            </div>
        </div> 

    </main>

    <dialog id="filtro-modal" class="filtro-modal">
        <button class="close-modal" data-modal="filtro-modal" type="button">
                    <i class="fa-solid fa-circle-xmark"></i>
        </button>
        <form method="dialog">
            <h2>Filtrar Contratos</h2>

            <div class="filtro-opcao" id="campo-finalizados">
                <input type="checkbox" id="mostrar-finalizados">
                <label for="mostrar-finalizados">Mostrar finalizados</label>
            </div>

            <div class="filtro-opcao1">
                <div class="filter-data">
                    <label for="filtro-data">Data Venda:</label>
                    <input type="date" id="filtro-data-inicio">
                    <input type="date" id="filtro-data-final">
                </div>


                <div class="filter-corretor">
                    <label for="filtro-corretor">Corretor:</label>
                    <input type="text" id="filtro-corretor">
                    </div>

                <div class="filter-empreendimento">
                    <label for="filtro-empreendimento">Empreendimento:</label>
                    <input type="text" id="filtro-empreendimento">
                    </div>

                <div class="filter-etiquetas">
                    <label for="filtro-etiquetas">Etiquetas:</label>
                    <select type="text" id="filtro-etiquetas">
                        <option value="">-- Selecione uma opção --</option>
                        <option value="Autenticado">Autenticado</option>
                        <option value="Carnê Gerado">Carnê Gerado</option>
                        <option value="Digitalizado">Digitalizado</option>
                        <option value="Pagamento OK">Pagamento OK</option>
                    </select>
                    </div>


            </div>
            

            <div class="filtro-container">
                <button id="filtro-actions">Aplicar Filtro</button>
            </div>
            
        </form>
    </dialog>
    
    <dialog id="create-special-modal" class="filtro-modal">
        <button class="close-modal" data-modal="create-special-modal" type="button">
            <i class="fa-solid fa-circle-xmark"></i>
        </button>
        <form id="create-special-form" method="dialog">
            <h2>Criar Contrato Especial</h2>
            
            <div class="form-group">
                <label for="create-tipo">Tipo:</label>
                <select id="create-tipo" required>
                    <option value="" disabled selected>-- Selecione --</option>
                    <option value="D">Distrato</option>
                    <option value="T">Transferência</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="create-codcli">Número Venda (Numped):</label>
                <input type="number" id="create-codcli" placeholder="Ex: 12345" required>
            </div>

            <div class="filtro-container">
                <button id="create-special-submit" type="submit">Criar Contrato</button>
            </div>
        </form>
    </dialog>

    <script>
        window.KANBAN_TOKEN = "<?= htmlspecialchars($tokenKanban, ENT_QUOTES, 'UTF-8') ?>";
    </script>
    <script 
        src="src/javascript/script.js">
    </script>
    </div>
</body>
</html>