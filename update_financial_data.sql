-- Script para atualizar departamentos, PIX e status de CLT (Registrado) em massa
-- Execute este script no SQL Editor do Supabase.

-- 1. Garantir que as colunas existem
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS pix TEXT;

-- 2. Atualização em massa com base na lista oficial do usuário
-- Regras aplicadas: 
-- - Se duplicado, opta pelo "Ativo"
-- - Se MODALIDADE for "Registrado" ou "SÓCIA", marca is_registered = true
UPDATE public.people AS p
SET 
  department = v.dept,
  pix = v.pix_val,
  is_registered = v.is_reg
FROM (VALUES
    ('Adam de Pierre Pavan', '3D', '62012753000174', false),
    ('Alexandre Augusto Teixeira', 'PRODUÇÃO', '294.572.068-00', true),
    ('Alexandre Pereira de Lima', 'Geral', '379.084.538-80', true),
    ('Allan Bruno Ribeiro de Lima', 'SERRALHERIA', '372.316.078-61', false),
    ('Anderson Gomes Nunes', 'ACABAMENTO', '270.290.078-08', true),
    ('Anderson Pinheiro de Sá', 'ACABAMENTO', '+5511963616216', false),
    ('Antonio Paulo Teixeira', 'ACABAMENTO', '657.835.144-20', true),
    ('Brenno Mendes de Sousa', 'ROUTER', '+5511974173064', true),
    ('Bruno Alves de Moraes Sarmento Duarte', 'ADMINISTRATIVO', '426.133.928-51', true),
    ('Carlos Alberto Silva Ramilo', 'ACABAMENTO', '095.317.488-37', false),
    ('Cassiano Cabral da Silva', 'MARCENARIA', '+5511979557702', false),
    ('Cicero Manoel da Silva', 'GERAL', '+5511986240612', true),
    ('Cristiano Chiarella Ortiz', 'ADMINISTRATIVO', 'cristianochiarella@yahoo.com.br', false),
    ('Davi Magistrali Rocco', '3D', '47988067741', true),
    ('Debora dos Santos Aragao', 'ESCULTURA', '162.914.058-90', true),
    ('Debora Vitoria Oliveira Bezerra', 'ESCULTURA', '412.379.068-22', false),
    ('Denis Danilo da Silva Bezerra', 'LAMINAÇÃO', '+5511945021627', false),
    ('Edigenaldo Leal da Costa', 'ACABAMENTO', '136.529.368-84', true),
    ('Eduardo Cardoso Garcia', 'PINTURA', '306.383.388-67', true),
    ('Elias dos Santos Aragao', 'GERAL', 'fe877db1-b74c-4d44-bc2c-2d2d71a7df8e', true),
    ('Emilena dos Santos Aragão', 'ESCULTURA', '+5511983682141', false),
    ('Eugenio Paulino Oliveira de Barros', 'ACABAMENTO', '+5511977575581', false),
    ('Evandro Luiz de Moraes', 'LAMINAÇÃO', '+5511939009279', true),
    ('Everton Simões Fernandes Teixeira', 'ADMINISTRATIVO', '+5588997053583', true),
    ('Fabio Rogerio Marques', 'PINTURA', 'nickodelico@gmail.com', false),
    ('Franciluvio Gomes da Silva', 'LAMINAÇÃO', '+5511951516920', true),
    ('Francisco Ronaldo Vericio Junior', 'ACABAMENTO', '336.630.568-13', false),
    ('Gabriel Franco de Souza', 'ESCULTURA', '424.036.118-40', false),
    ('Gabriel Marques Vieira', 'ALMOXARIFADO', '+5511992171650', true),
    ('Gabriela Aragão Ferreira', 'COMERCIAL', '+5511981067305', true),
    ('Herick Araujo de Souza', 'SERRALHERIA', 'aherick060@gmail.com', false),
    ('Italo Elmer Lima', 'ROUTER', 'italoelmer2022@gmail.com', true),
    ('Jailson Alonso de Souza', 'ELETRICA', '0', false),
    ('Janivaldo Roberto de Luna', 'LAMINAÇÃO', '445.162.823-72', true),
    ('Jessica de Souza Franco', 'ADMINISTRATIVO', '410.611.218-36', true),
    ('Joao Luiz Madureira', 'LAMINAÇÃO', '+5511963924038', true),
    ('Jose Augusto Silva Ferreira', 'MARCENARIA', '+5511978411484', false),
    ('Jose dos Santos Xavier', 'ACABAMENTO', '+5511951351738', true),
    ('Jose Jonas Carvalho Silva', 'ACABAMENTO', '187.575.778-38', true),
    ('Jozilda Nunes de Oliveira', 'COMPRAS', '355.278.738-07', true),
    ('Julia de Paula Ferreira', 'COMPRAS', '480.454.818-11', false),
    ('Juliane Silva dos Anjos', 'COMERCIAL', '446.268.708-64', true),
    ('Leonardo Guilherme de Souza', '3D', '+5511967152110', true),
    ('Leticia Oliveira da Silva', 'ADMINISTRATIVO', '316.033.488-08', true),
    ('Luciene da Silva Santos', 'LIMPEZA', '153.375.678-37', true),
    ('Maiara de Souza da Silva Dias', 'ADMINISTRATIVO', '+5511978727388', true),
    ('Marcio Oliveira dos Santos', 'GERAL', '+5511991691661', true),
    ('Marcus Vinicius da Silva Lima', 'ADMINISTRATIVO', '+5511949310899', true),
    ('Mariana Basilio Vieira Fernandes Matos', 'GERAL', '+5521996224872', false),
    ('Mariane Bispo Roseno', 'ESCULTURA', 'marianebisporoseno@yahoo.com', false),
    ('Monique Godoy da Silva Andrade', 'MARKETING', 'moniquegodoy.andrade@gmail.com', true),
    ('Nanci do Nascimento Ferreira Luis', 'ADMINISTRATIVO', '+5511988104529', true),
    ('Nicolas Pedroza Campeiro Vaz', 'ESCULTURA', 'nicolaspedroza70@gmail.com', false),
    ('Odair Jose Tomaz', 'MARCENARIA', '180.969.778-65', true),
    ('Paulo dos Santos Xavier', 'ACABAMENTO', 'px9757982@gmail.com', true),
    ('Paulo Sergio Barbosa Elias', 'ACABAMENTO', '303.776.888-60', false),
    ('Rafael Ferreira da Silva', 'LAMINAÇÃO', '+5511952148101', true),
    ('Reinaldo Braga Tavares', 'SERRALHERIA', '263.944.208-24', false),
    ('Samuel Magalhaes', 'ESCULTURA', '185.923.168-39', true),
    ('Siloel Antonio do Nascimento', 'ACABAMENTO', 'não tem', false),
    ('Thaynara Christine Araujo Pereira', 'PINTURA', '+5511930523316', false),
    ('Thiago Teixeira da Silva', '3D', '44.428.846/0001-00', false),
    ('Tomas Di Febbo', 'ROUTER', '+5511993147935', true),
    ('Tony Kifua Lin', 'ADMINISTRATIVO', '37.754.794/0001-99', false),
    ('Valdson Vagno Silva dos Santos', 'MARCENARIA', '116.159.054-48', false),
    ('Victor Henrique Tecco', '3D', 'teko3d@hotmail.com', true),
    ('Vinicius Franco de Souza', 'ESCULTURA', '+5511994210584', true),
    ('Wanderson Reis Souza', 'ADMINISTRATIVO', '061.505.575-37', true),
    ('Fabio Paulino dos Santos', 'PINTURA', '+5511952028591', false)
) AS v(name, dept, pix_val, is_reg)
WHERE p.name = v.name;
