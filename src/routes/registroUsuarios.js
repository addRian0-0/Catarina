const express = require('express');
const router = express.Router();
const pool = require('../database');
const { body, validationResult } = require('express-validator');
const cifrar = require('../lib/cifrados');
const buscarEsc = require('../lib/buscarEscuela');
const nodemailer = require('nodemailer');
const { mailVerificacionUsuarioCatarinaAlumno, mailVerificacionUsuarioCatarinaProf } = require("../template-mails"); 

router.get('/alumnos/:contraAlum', async (req, res) => {
    var escuelaBuscada = await buscarEsc.buscarA(req.params.contraAlum)
    const escuelaBuscadaN = escuelaBuscada[0];
    if (escuelaBuscada.length > 0) {
        res.render('auth/regAlum');
        router.post('/registrarAlum',
            [body('user_nom', 'Ingrese su nombre.').exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body('user_appat', 'Ingrese su apellido paterno.').exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body("user_apmat", "Ingrese su apellido materno").exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body('user_correo', 'Ingrese un email válido.').exists().isEmail(),
            body('user_contra', 'La contraseña debe tener un largo de mínimo 9 caracteres').exists().matches(/^(?=\w*\d)(?=\w*[A-Z])(?=\w*[a-z])\S{8,20}$/),
            body('grupo_alum', 'El grupo tiene que tener únicamente letras y números').exists().matches(/^[0-9a-zA-ZÀ-ÿ\s]{1,10}$/),
            body("user_edad", "Ingrese una fecha válida").exists(),
            body('user_sexo', 'Elija un sexo.').exists(),
            body('terminos', 'Acepte los terminos.').exists()],
            async (req, res) => {
                var valores = req.body;
                delete valores.terminos;
                let grupoA = req.body.grupo_alum;
                let errors = validationResult(req);
                if (!errors.isEmpty()) {
                    console.log(valores)
                    res.render('auth/regAlum', {
                        alert: true,
                        alertTitle: "Error al registrar.",
                        alertMessage: "No se pudo registrar correctamente, favor de llenar el formulario correctamente.",
                        alertIcon: "error",
                        showConfirmButton: true,
                        timer: 3000,
                        ruta: 'registro/alumnos/' + escuelaBuscadaN.escuela_contraAlum
                    });
                    console.log(errors);
                } else {
                    var correoExistente = await pool.query('SELECT * FROM usuarios WHERE user_correo = ?', [valores.user_correo])
                    if (correoExistente.length > 0) {
                        res.render('auth/regAlum', {
                            alert: true,
                            alertTitle: "CORREO",
                            alertMessage: "El correo electrónico que ingresaste ya existe, intenta ingresar otro.",
                            alertIcon: "error",
                            showConfirmButton: true,
                            timer: 5000,
                            ruta: 'registro/alumnos/' + escuelaBuscadaN.escuela_contraAlum
                        });
                    } else {
                        let contraCifrada = await cifrar.cifrar(valores.user_contra);
                        const datosFaltantes = { user_contra: contraCifrada, tipo_user: 'Alumno', escuela_id: escuelaBuscadaN.id_escuela }
                        delete valores.grupo_alum;
                        var resultFinal = Object.assign(valores, datosFaltantes);
                        pool.query('INSERT INTO usuarios SET ?', [resultFinal], async (error, results) => {
                            if (error) {
                                console.log(error);
                            } else {
                                infoAlumno = await pool.query('SELECT * FROM usuarios WHERE user_correo = ?', [valores.user_correo]);
                                //CONSULTA PARA TOMAR EL ID DEL ALUMNO QUE SE ACABA DE GUARDAR
                                datosAlumno = infoAlumno[0];
                                let grupoAlum = { usuarios_id: datosAlumno.id_user, grupo_alum: grupoA }
                                await pool.query('INSERT INTO alumnos SET ?', [grupoAlum], async (err, resul) => {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        let protocol = req.get('X-Forwarded-Protocol');
                                        if (protocol === undefined) {
                                            protocol = '';
                                        }
                                        const host = req.get('host');
                                        const linkAlum = protocol + host + "/verificaUsuarioNuevo/" + datosAlumno.id_user;
                                        var transporter = nodemailer.createTransport({
                                            host: "smtp.gmail.com",
                                            port: 465,
                                            secure: true,
                                            auth: {
                                                user: "dictamigosasocs@gmail.com",
                                                pass: "vkwjipzlmiqlmfda",
                                            }
                                        });
                                        let templateBuildMail = mailVerificacionUsuarioCatarinaAlumno(linkAlum);
                                        var mailOptions = {
                                            from: "dictamigosasocs@gmail.com",
                                            to: valores.user_correo,
                                            subject: 'Verificación de usuario Catarina',
                                            html: templateBuildMail
                                        }
                                        transporter.sendMail(mailOptions, (error, inf) => {
                                            if (error) {
                                                res.render('auth/regAlum', {
                                                    alert: true,
                                                    alertTitle: "Ocurrió un error inesperado.",
                                                    alertMessage: "Por favor, vuelva a intentar",
                                                    alertIcon: "error",
                                                    showConfirmButton: true,
                                                    timer: 3000,
                                                    ruta: 'registro/alumnos/' + escuelaBuscadaN.escuela_contraAlum
                                                })
                                                console.log("el error es..................." + error)
                                            } else {
                                                console.log("Email enviado correctamente")
                                                res.render('auth/regAlum', {
                                                    alert: true,
                                                    alertTitle: "Verifica tu cuenta.",
                                                    alertMessage: "Se ha enviado un correo eléctronico a la dirección que ingresaste, por favor acceder a él para verificar su cuenta.",
                                                    alertIcon: "success",
                                                    showConfirmButton: true,
                                                    timer: 3000,
                                                    ruta: 'iniciarSesion'
                                                })
                                            }
                                        })
                                    }
                                });
                            }
                        });
                    }
                }
            });
    } else {
        res.render('partials/errorcodigos');
    }
});



router.get('/profesores/:contraProf', async (req, res) => {
    var escuelaBuscada = await buscarEsc.buscarP(req.params.contraProf)
    const escuelaBuscadaN = escuelaBuscada[0];
    if (escuelaBuscada.length > 0) {
        res.render('auth/regProf');
        router.post('/registrarProf',
            [body('user_nom', 'Ingrese su nombre.').exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body('user_appat', 'Ingrese su apellido paterno.').exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body("user_apmat", "Ingrese su apellido materno").exists().matches(/^[a-zA-ZÀ-ÿ\s]{1,40}$/),
            body('user_correo', 'Ingrese un email válido.').exists().isEmail(),
            body('user_contra', 'La contraseña debe tener un largo de mínimo 9 caracteres').exists().matches(/^(?=\w*\d)(?=\w*[A-Z])(?=\w*[a-z])\S{8,20}$/),
            body("user_edad", "Ingrese una fecha válida").exists(),
            body('user_sexo', 'Elija un sexo.').exists(),
            body('terminos', 'Acepte los terminos.').exists()],
            async (req, res) => {
                var valores = req.body;
                delete valores.terminos;
                let grupoA = req.body.grupo_alum;
                let errors = validationResult(req);
                if (!errors.isEmpty()) {
                    console.log(valores)
                    res.render('auth/regAlum', {
                        alert: true,
                        alertTitle: "Error al registrar.",
                        alertMessage: "No se pudo registrar correctamente, favor de llenar el formulario correctamente.",
                        alertIcon: "error",
                        showConfirmButton: true,
                        timer: 3000,
                        ruta: 'registro/profesores/' + escuelaBuscadaN.escuela_contraProf
                    });
                    console.log(errors);
                } else {
                    var correoExistente = await pool.query('SELECT * FROM usuarios WHERE user_correo = ?', [valores.user_correo])
                    if (correoExistente.length > 0) {
                        res.render('auth/regDirec', {
                            alert: true,
                            alertTitle: "CORREO",
                            alertMessage: "El correo electrónico que ingresaste ya existe, intenta ingresar otro.",
                            alertIcon: "error",
                            showConfirmButton: true,
                            timer: 5000,
                            ruta: 'registro/profesores/' + escuelaBuscadaN.escuela_contraProf
                        });
                    } else {
                        let contraCifrada = await cifrar.cifrar(valores.user_contra);
                        const datosFaltantes = { user_contra: contraCifrada, tipo_user: 'Profesor', escuela_id: escuelaBuscadaN.id_escuela }
                        delete valores.grupo_alum;
                        var resultFinal = Object.assign(valores, datosFaltantes);
                        pool.query('INSERT INTO usuarios SET ?', [resultFinal], async (error, results) => {
                            if (error) {
                                console.log(error);
                            } else {
                                infoProf = await pool.query('SELECT * FROM usuarios WHERE user_correo = ?', [valores.user_correo]);
                                //CONSULTA PARA TOMAR EL ID DEL ALUMNO QUE SE ACABA DE GUARDAR
                                datosProf = infoProf[0];
                                let protocol = req.get('X-Forwarded-Protocol');
                                if (protocol === undefined) {
                                    protocol = '';
                                }
                                const host = req.get('host');
                                const linkProf = protocol + host + "/verificaUsuarioNuevo/" + datosProf.id_user;
                                var transporter = nodemailer.createTransport({
                                    host: "smtp.gmail.com",
                                    port: 465,
                                    secure: true,
                                    auth: {
                                        user: "dictamigosasocs@gmail.com",
                                        pass: "vkwjipzlmiqlmfda",
                                    }
                                });
                                let mailBuildTemplate = mailVerificacionUsuarioCatarinaProf(linkProf);
                                var mailOptions = {
                                    from: "dictamigosasocs@gmail.com",
                                    to: valores.user_correo,
                                    subject: 'Verificación de usuario Catarina',
                                    html: mailBuildTemplate
                                }
                                transporter.sendMail(mailOptions, (error, inf) => {
                                    if (error) {
                                        res.render('auth/regProf', {
                                            alert: true,
                                            alertTitle: "Ocurrió un error inesperado.",
                                            alertMessage: "Por favor, vuelva a intentar",
                                            alertIcon: "error",
                                            showConfirmButton: true,
                                            timer: 3000,
                                            ruta: 'registro/profesores/' + escuelaBuscadaN.escuela_contraProf
                                        })
                                        console.log("el error es..................." + error)
                                    } else {
                                        console.log("Email enviado correctamente")
                                        res.render('auth/regProf', {
                                            alert: true,
                                            alertTitle: "Verifica tu cuenta.",
                                            alertMessage: "Se ha enviado un correo eléctronico a la dirección que ingresaste, por favor acceder a él para verificar su cuenta.",
                                            alertIcon: "success",
                                            showConfirmButton: true,
                                            timer: 3000,
                                            ruta: 'iniciarSesion'
                                        })
                                    }
                                })
                            }
                        });
                    }
                }
            });
    } else {
        res.render('partials/errorcodigos');
    }
});




module.exports = router;
