const express = require('express');
const homeController = require('../controllers/homeController');

const router = express.Router();

router.get('/', homeController.index);
router.get('/gestacao', homeController.gestacao);
router.post('/gestacao', homeController.saveAcompanhamento);
router.get('/protocolos-medicos', homeController.protocolosMedicos);
router.post('/protocolos-medicos/:idProtocolo/conclusao', homeController.atualizarConclusaoProtocolo);

module.exports = router;
