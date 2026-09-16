const express = require('express');
const registerController = require('../controllers/registerController');

const router = express.Router();

router.get('/cadastro', registerController.showRegister);
router.post('/cadastro', registerController.register);
router.get('/situacao-gestacao', registerController.showPregnancyStatus);
router.post('/situacao-gestacao', registerController.choosePregnancyStatus);
router.get('/dados-gestacao', registerController.showPregnancyForm);
router.post('/dados-gestacao', registerController.savePregnancy);
router.get('/avaliacao-risco', registerController.showAvaliacaoRisco);
router.post('/avaliacao-risco', registerController.saveAvaliacaoRisco);
router.get('/chave-acesso', registerController.showAccessKey);
router.post('/chave-acesso', registerController.checkAccessKey);

module.exports = router;
