/* eslint consistent-return: 0 */
import express from 'express'
import morgan from 'morgan'
import bodyParser from 'body-parser'
import storage from 'node-persist'
import { getFileContents } from './utils'
import { HELP_MESSAGE, EMPTY_REQUEST, ERROR_MESSAGE } from './constants'

const { SLACK_VERIFY_TOKEN, PORT } = process.env
if (!SLACK_VERIFY_TOKEN) {
    console.error('SLACK_VERIFY_TOKEN is required')
    process.exit(1)
}
if (!PORT) {
    console.error('PORT is required')
    process.exit(1)
}

// TODO: Since we have a 3000ms window to initially respond, we should send an immediate response based off validation. Then follow up message with actual file info using the response_url.

const app = express()
app.use(morgan('dev'))

app.route('/code')
    .get((req, res) => {
        res.sendStatus(200)
    })
    .post(bodyParser.urlencoded({ extended: true }), (req, res) => {
        if (req.body.token !== SLACK_VERIFY_TOKEN) {
            return res.sendStatus(401)
        }

        const { text, response_url, team_id } = req.body

        // Handle empty request
        if (!text) {
            return res.json({
                response_type: 'ephemeral',
                text: EMPTY_REQUEST
            })
        }

        // Handle any help requests
        if (text === 'help') {
            return res.json({
                response_type: 'ephemeral',
                text: HELP_MESSAGE
            })
        }

        // Iterate through storage data
        storage.forEach((key, value) => {

            // Match team ID in storage from request
            if (value.slackTeamID === team_id) {

                // Get file contents from Beanstalk
                getFileContents(text, {
                    username: value.bsUsername,
                    token: value.bsAuthToken
                }, (err, content) => {
                    if (err) {
                        return res.json({
                            response_type: 'ephemeral',
                            text: `${ ERROR_MESSAGE } ${ err.message }`
                        })
                    }

                    return res.json({
                        response_type: 'ephemeral',
                        ...content
                    })
                })
            }
        })
    })

app.listen(PORT, (err) => {
    if (err) {
        return console.error('Error starting server: ', err)
    }

    return console.log('Server successfully started on port %s', PORT)
})
