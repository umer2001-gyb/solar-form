const functions = require("firebase-functions");
const path = require("path");
const os = require("os");
const fs = require("fs");

const Busboy = require("busboy");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

/*
 * Using Gmail to send
 * configs for gmail
 */
const emailAddress = "temptesting135@gmail.com";
const emailPassword = "sdeftukmnwmsblkz";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailAddress,
    pass: emailPassword,
  },
});

// other configs
const receiverEmailAddress = "umer2001.uf@gmail.com";

// SEND MAIL FUNCTION
exports.sendMail = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== "POST") {
      // Return a "method not allowed" error
      return res.status(405).end({
        statusCode: 405,
        message: "Method not allowed",
      });
    }
    // eslint-disable-next-line
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1 },
    });
    const tmpdir = os.tmpdir();

    let pdfFilePath = null;
    const fileWrites = [];

    busboy.on("file", (fieldname, file, { filename }) => {
      // Note: os.tmpdir() points to an in-memory file system on GCF
      // Thus, any files in it must fit in the instance's memory.
      if (fieldname === "blob") {
        console.log(`Processed file ${filename}`);
        const filepath = path.join(tmpdir, filename);
        pdfFilePath = filepath;

        const writeStream = fs.createWriteStream(filepath);
        file.pipe(writeStream);

        const promise = new Promise((resolve, reject) => {
          file.on("end", () => {
            writeStream.end();
          });
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
        fileWrites.push(promise);
      }
    });

    // eslint-disable-next-line
    busboy.on("finish", async () => {
      // await fileWrites
      await Promise.all(fileWrites);

      if (!pdfFilePath) {
        return res.status(400).end({
          statusCode: 400,
          error: "No file uploaded",
        });
      }
      // send mail
      const mailOptions = {
        from: `Solar Project <${emailAddress}>`,
        to: receiverEmailAddress,
        subject: "New Lead Generated!",
        attachments: [
          {
            filename: `lead-form-${new Date()
              .toISOString()
              .replace(/T.*/, "")
              .split("-")
              .reverse()
              .join("-")}.pdf`,
            contentType: "application/pdf",
            path: pdfFilePath, // file is a stream
          },
        ],
      };

      return transporter.sendMail(mailOptions, (erro, info) => {
        if (erro) {
          return res.status(500).send({
            statusCode: 500,
            error: erro.toString(),
          });
        }
        return res.send({
          statusCode: 200,
          message: "Mail sent successfully",
        });
      });
    });

    busboy.on("error", (err) => {
      console.error(err);
      res.status(500).send({
        statusCode: 500,
        error: err.toString(),
      });
    });

    busboy.end(req.rawBody);
  });
});
