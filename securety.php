<?php
//session_start();
require "../config/config.php";
require "../config/funcoes.php";
$search  = array('.', '-'); 
error_reporting(E_ERROR);

$vuser    = $_SESSION['login'];

$sql0 = "SELECT count(9) qt FROM rotina_acesso where ID_ROTINA=$id_rotina and ID_USER=$vuser";;
$todos0  = mysql_query($sql0);
$dados0  = mysql_fetch_array($todos0);
$qt      = $dados0['qt'];


if ($qt<1) {
?>
<script type="application/javascript">
var idrotina = <?=$id_rotina?>;
alert("* Rotina ("+idrotina+") nao autorizada!!! \r\n* Por favor verificar com o Administrador do Sistema.");
window.location.href = "javascript:window.history.go(-1)";
</script>
<?php
    //header("Location: index.php");
    exit();
}
?>