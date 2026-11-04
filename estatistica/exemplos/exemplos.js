// exemplos.js - os mesmos CSV de estatistica/exemplos/ como modulo (a CSP da pagina bloqueia fetch).
// teste_estatistica.js confere que o conteudo e igual ao dos arquivos.
export const ARQUIVOS = {"anova":"exemplo_anova_univariado.csv","manova":"exemplo_manova.csv","fatorial":"exemplo_2k_fatorial.csv","ccd":"exemplo_ccd.csv"};
export const EXEMPLOS = {
  anova: "tratamento,resultado\r\nA,12.3\r\nA,13.1\r\nA,11.8\r\nA,12.9\r\nA,13.5\r\nB,15.2\r\nB,14.8\r\nB,16.1\r\nB,15.5\r\nB,14.9\r\nC,10.1\r\nC,9.8\r\nC,10.5\r\nC,9.6\r\nC,10.3\r\nD,18.2\r\nD,17.9\r\nD,18.5\r\nD,18.1\r\nD,17.7\r\n",
  manova: "grupo;dureza;rugosidade\nG1;18,347;9,324\nG1;23,426;11,893\nG1;17,866;9,21\nG1;19,662;10,823\nG1;17,849;10,461\nG1;18,542;7,898\nG1;20,993;8,639\nG1;17,874;7,186\nG2;22,63;11,837\nG2;24,774;11,961\nG2;19,985;10,182\nG2;22,209;9,866\nG2;19,532;10,693\nG2;21,015;9,274\nG2;18,073;7,518\nG3;20,963;12,906\nG3;24,878;13,478\nG3;19,27;14,897\nG3;23,031;12,993\nG3;18,698;10,958\nG3;20,79;14,832\nG3;19,94;11,465\nG3;19,125;10,076\nG3;22,002;13,808\n",
  fatorial: "fator_A,fator_B,fator_C,resposta\r\n-1,-1,-1,23.4\r\n1,-1,-1,27.8\r\n-1,1,-1,19.2\r\n1,1,-1,31.5\r\n-1,-1,1,25.1\r\n1,-1,1,29.3\r\n-1,1,1,21.7\r\n1,1,1,34.2\r\n-1,-1,-1,22.9\r\n1,-1,-1,28.1\r\n-1,1,-1,18.8\r\n1,1,-1,32.0\r\n-1,-1,1,24.7\r\n1,-1,1,30.0\r\n-1,1,1,22.3\r\n1,1,1,33.8\r\n",
  ccd: "temperatura,pressao,conversao,seletividade\r\n-1,-1,68.2,82.1\r\n1,-1,74.5,79.3\r\n-1,1,71.3,85.4\r\n1,1,80.1,81.2\r\n-1.414,0,65.8,83.7\r\n1.414,0,82.3,78.9\r\n0,-1.414,70.1,80.5\r\n0,1.414,75.6,86.2\r\n0,0,77.4,84.1\r\n0,0,78.1,83.8\r\n0,0,76.9,84.5\r\n0,0,77.8,83.9\r\n0,0,77.2,84.3\r\n",
};
