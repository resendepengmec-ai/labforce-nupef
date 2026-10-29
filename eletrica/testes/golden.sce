// golden.sce - gera saidas de referencia da v5.3.3 (Scilab) para comparar com a versao web
// Faixas fixas (fracoes do ensaio), todas as grandezas ligadas, sem graficos.
// dirV: pasta com os .sci da v5.3.3 (Scilab); ajuste antes de rodar
dirV = "../../scilab/v5.3.3/";
exec(dirV + "funcoesPotencia.sci", -1); exec(dirV + "qualidadeIEEE519.sci", -1); exec(dirV + "potenciasIEEE1459.sci", -1);
dirT = get_absolute_file_path("golden.sce");
fRede = 60; nCicVis = 30; IscIL = 10; IL519 = %nan; atrasoCanal = [0 0 0 0 0 0];
kV = [1.2483 1.2492 1.2803]; kI = [1.2434 1.1984 1.2213];
cteT2Ard = (3.3/4096)*996; cteC2Ard = (3.3/4096)*78.1;
arqs = ["E1R1" "E8R1" "S800" "S1000_instavel" "S2000" "S333"];
for a = arqs
  out = [];
  mD = fscanfMat(dirT + "dados/" + a + ".txt");
  S = list();
  for k = 1:6
    if k <= 3 then c = cteT2Ard*kV(k); else c = cteC2Ard*kI(k-3); end
    S(k) = (mD(:, k) - mean(mD(:, k)))*c;
  end
  Va = S(1); Vb = S(2); Vc = S(3); Ia = S(4); Ib = S(5); Ic = S(6);
  [fs, fsBruta, varFs, regraFs] = detectaFs(Va, fRede);
  N = size(Va, 1);
  out($+1) = msprintf("fs %.10g fsBruta %.10g varFs %.6f regra %s", fs, fsBruta, varFs, regraFs);
  Pot = Va.*Ia + Vb.*Ib + Vc.*Ic;
  Pinst = mediaMovelCiclos(Pot, fs, fRede, nCicVis);
  out($+1) = msprintf("Pinst %.8e %.8e %.8e", Pinst(1), Pinst(round(N/2)), Pinst(N));
  // faixas: 10%..80% e 50% + 2,5 s (bloco curto)
  F = [round(0.1*N) round(0.8*N); round(0.5*N) round(0.5*N) + round(2.5*fs)];
  for jf = 1:2
    c1 = F(jf, 1); c2 = F(jf, 2); rotulo = a + "_f" + string(jf);
    Vax = Va(c1:c2); Vbx = Vb(c1:c2); Vcx = Vc(c1:c2); Iax = Ia(c1:c2); Ibx = Ib(c1:c2); Icx = Ic(c1:c2);
    tu = (c2 - c1)/fs;
    g = grandezasEletricas(Vax, Vbx, Vcx, Iax, Ibx, Icx);
    sV = list(Vax, Vbx, Vcx); sI = list(Iax, Ibx, Icx); eV = list(); eI = list();
    for k = 1:3, eV(k) = espectroFFT(sV(k), fs, fRede); eI(k) = espectroFFT(sI(k), fs, fRede, eV(k).k); end
    f1 = mean([eV(1).f1, eV(2).f1, eV(3).f1]);
    dVI = [difFase(eV(1).ph1, eI(1).ph1), difFase(eV(2).ph1, eI(2).ph1), difFase(eV(3).ph1, eI(3).ph1)];
    out($+1) = msprintf("fft %s f1 %.8f A1 %.8f %.8f %.8f I1 %.8f %.8f %.8f VI %.6f %.6f %.6f dVb %.6f dVc %.6f k %d", rotulo, f1, ..
        eV(1).A1, eV(2).A1, eV(3).A1, eI(1).A1, eI(2).A1, eI(3).A1, dVI(1), dVI(2), dVI(3), ..
        difFase(eV(2).ph1, eV(1).ph1), difFase(eV(3).ph1, eV(1).ph1), eV(1).k - 1);
    q = analiseIEEE519([Vax Vbx Vcx], [Iax Ibx Icx], fs, fRede, f1, IscIL, IL519);
    if q.ok & varFs > 0.5 then
      q.stTHDv = "FS_INSTAVEL"; q.stTDD = "FS_INSTAVEL"; q.statusV = "FS_INSTAVEL"; q.statusI = "FS_INSTAVEL";
      q.stV(:) = "FS_INSTAVEL"; q.stI(:) = "FS_INSTAVEL";
    end
    relatorioIEEE519(q, TMPDIR + "/g");
    out = [out; "519 " + linhaResumoIEEE519(q, rotulo, f1); "H " + mgetl(TMPDIR + "/g_IEEE519_harmonicos.csv")];
    r59 = analiseIEEE1459([Vax Vbx Vcx], [Iax Ibx Icx], fs, fRede, f1, atrasoCanal);
    out($+1) = "1459 " + linhaIEEE1459(r59, rotulo);
    b = r59.blocos($);
    out($+1) = msprintf("1459b %d %.6f %.6f %.6f %.6f", r59.nB, b.P, b.Se, b.FDv, b.THDeI);
    nums = msprintf("%.1f %.1f %.3f %.2f %.1f %.3f %.3f %.6g", g.Pt, g.Vrms(1), g.Ief, tu, g.St, g.FP, f1, fs);
    out($+1) = "dados " + rotulo + " " + strsubst(nums, ".", ",");
  end
  mputl(out, dirT + "golden/" + a + ".txt");
  mprintf("%s ok\n", a);
end
exit
